import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  LocalizedContentScope,
  LocalizedTranslationSource,
  LocalizedTranslationStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContext } from '../../shared/application/request-context';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { TRANSLATION_PROVIDER_PORT, TranslationProviderPort } from './providers/translation-provider.port';
import { LocalizableEntityType, LocalizableSourceFields, LocalizedFieldDescriptor, LocalizationPolicy } from './localization.types';

const DEFAULT_LANGUAGE = 'es';
const MAX_LANGUAGE_LENGTH = 10;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_MONTHLY_REQUEST_LIMIT = null as number | null;
const DEFAULT_MONTHLY_CHARACTER_LIMIT = null as number | null;
const DEFAULT_CIRCUIT_BREAKER = {
  enabled: true,
  failureRateThreshold: 0.6,
  minSamples: 12,
  consecutiveFailures: 6,
  windowMinutes: 30,
  pauseMinutes: 30,
} as const;

const trimText = (value: string | null | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeLanguageCode = (value?: string | null): string =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, MAX_LANGUAGE_LENGTH);

const hashText = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

type LocalizationSummaryStatus = 'ready' | 'pending' | 'failed' | 'stale' | 'missing';

type MonthlyUsage = {
  requests: number;
  characters: number;
};

@Injectable()
export class LocalizationService {
  private readonly logger = new Logger(LocalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    @Inject(TRANSLATION_PROVIDER_PORT)
    private readonly translationProvider: TranslationProviderPort,
  ) {}

  async syncEntitySourceFields(params: {
    context?: RequestContext;
    entityType: LocalizableEntityType;
    entityId: string;
    fields: LocalizableSourceFields;
  }) {
    const context = params.context || this.tenantContextPort.getRequestContext();
    const scope = context.localId ? LocalizedContentScope.location : LocalizedContentScope.brand;
    const policy = await this.getPolicy(context.brandId, context.localId);

    const fieldEntries = Object.entries(params.fields)
      .map(([fieldKey, rawText]) => ({ fieldKey, sourceText: trimText(rawText) }))
      .filter((entry) => entry.sourceText.length > 0);

    if (fieldEntries.length === 0) return;

    for (const entry of fieldEntries) {
      const sourceHash = hashText(entry.sourceText);
      const where = {
        scope_brandId_localId_entityType_entityId_fieldKey: {
          scope,
          brandId: context.brandId,
          localId: context.localId,
          entityType: params.entityType,
          entityId: params.entityId,
          fieldKey: entry.fieldKey,
        },
      } as const;

      const existing = await this.prisma.localizedContent.findUnique({
        where,
        include: {
          translations: {
            select: { id: true, language: true, manualLocked: true },
          },
        },
      });

      if (!existing) {
        const created = await this.prisma.localizedContent.create({
          data: {
            scope,
            brandId: context.brandId,
            localId: context.localId,
            entityType: params.entityType,
            entityId: params.entityId,
            fieldKey: entry.fieldKey,
            sourceLanguage: policy.defaultLanguage,
            sourceText: entry.sourceText,
            sourceHash,
            sourceVersion: 1,
          },
        });
        await this.ensureMissingTranslationRows({
          content: {
            ...created,
            sourceVersion: 1,
            sourceLanguage: policy.defaultLanguage,
          },
          supportedLanguages: policy.supportedLanguages,
        });
        continue;
      }

      const sourceChanged = existing.sourceHash !== sourceHash || existing.sourceLanguage !== policy.defaultLanguage;
      if (!sourceChanged) {
        await this.ensureMissingTranslationRows({
          content: existing,
          supportedLanguages: policy.supportedLanguages,
        });
        continue;
      }

      const nextVersion = existing.sourceVersion + 1;
      await this.prisma.localizedContent.update({
        where: { id: existing.id },
        data: {
          sourceLanguage: policy.defaultLanguage,
          sourceText: entry.sourceText,
          sourceHash,
          sourceVersion: nextVersion,
        },
      });

      await this.prisma.localizedContentTranslation.updateMany({
        where: {
          contentId: existing.id,
          language: { not: policy.defaultLanguage },
          manualLocked: false,
        },
        data: {
          status: LocalizedTranslationStatus.pending,
          basedOnSourceVersion: nextVersion,
          errorMessage: null,
        },
      });

      await this.prisma.localizedContentTranslation.updateMany({
        where: {
          contentId: existing.id,
          language: { not: policy.defaultLanguage },
          manualLocked: true,
        },
        data: {
          status: LocalizedTranslationStatus.stale,
          basedOnSourceVersion: nextVersion,
        },
      });

      await this.ensureMissingTranslationRows({
        content: {
          ...existing,
          sourceVersion: nextVersion,
          sourceLanguage: policy.defaultLanguage,
        },
        supportedLanguages: policy.supportedLanguages,
      });
    }
  }

  async localizeCollection<T extends { id: string }>(params: {
    context?: RequestContext;
    entityType: LocalizableEntityType;
    items: T[];
    descriptors: LocalizedFieldDescriptor<T>[];
  }): Promise<{ items: T[]; language: string }> {
    const context = params.context || this.tenantContextPort.getRequestContext();
    const policy = await this.getPolicy(context.brandId, context.localId);
    const language = this.resolveRequestedLanguage(context, policy);

    if (params.items.length === 0 || params.descriptors.length === 0) {
      return { items: params.items, language };
    }

    if (policy.supportedLanguages.length > 1) {
      await this.ensureSourceRowsFromItems({
        context,
        policy,
        entityType: params.entityType,
        items: params.items,
        descriptors: params.descriptors,
      });
    }

    if (language === policy.defaultLanguage) {
      return { items: params.items, language };
    }

    const contentRows = await this.prisma.localizedContent.findMany({
      where: {
        brandId: context.brandId,
        localId: context.localId,
        entityType: params.entityType,
        entityId: { in: params.items.map((item) => item.id) },
        fieldKey: { in: params.descriptors.map((descriptor) => descriptor.fieldKey) },
      },
      include: {
        translations: {
          where: { language },
          take: 1,
        },
      },
    });

    const rowMap = new Map<string, (typeof contentRows)[number]>();
    for (const row of contentRows) {
      rowMap.set(`${row.entityId}:${row.fieldKey}`, row);
    }

    for (const item of params.items) {
      for (const descriptor of params.descriptors) {
        const row = rowMap.get(`${item.id}:${descriptor.fieldKey}`);
        if (!row) continue;
        const translation = row.translations[0];
        if (!translation) continue;
        if (translation.status !== LocalizedTranslationStatus.ready) continue;
        if (translation.basedOnSourceVersion !== row.sourceVersion) continue;
        const translatedText = trimText(translation.translatedText);
        if (!translatedText) continue;
        descriptor.setValue(item, translatedText);
      }
    }

    return { items: params.items, language };
  }

  async upsertManualTranslation(params: {
    context?: RequestContext;
    entityType: LocalizableEntityType;
    entityId: string;
    fieldKey: string;
    language: string;
    translatedText: string;
    manualLocked?: boolean;
  }) {
    const context = params.context || this.tenantContextPort.getRequestContext();
    const policy = await this.getPolicy(context.brandId, context.localId);
    const language = normalizeLanguageCode(params.language);
    const text = trimText(params.translatedText);

    if (!language) {
      throw new BadRequestException('Idioma inválido.');
    }
    if (!policy.supportedLanguages.includes(language)) {
      throw new BadRequestException(`El idioma ${language} no está habilitado para este tenant.`);
    }
    if (!text) {
      throw new BadRequestException('La traducción manual no puede estar vacía.');
    }

    const content = await this.prisma.localizedContent.findFirst({
      where: {
        brandId: context.brandId,
        localId: context.localId,
        entityType: params.entityType,
        entityId: params.entityId,
        fieldKey: params.fieldKey,
      },
      select: {
        id: true,
        sourceLanguage: true,
        sourceVersion: true,
      },
    });

    if (!content) {
      throw new NotFoundException('No existe contenido base para ese campo.');
    }
    if (language === content.sourceLanguage) {
      throw new BadRequestException('No puedes guardar traducción manual para el idioma fuente.');
    }

    return this.prisma.localizedContentTranslation.upsert({
      where: {
        contentId_language: {
          contentId: content.id,
          language,
        },
      },
      create: {
        contentId: content.id,
        brandId: context.brandId,
        localId: context.localId,
        language,
        translatedText: text,
        status: LocalizedTranslationStatus.ready,
        source: LocalizedTranslationSource.manual,
        manualLocked: params.manualLocked !== false,
        basedOnSourceVersion: content.sourceVersion,
        lastGeneratedAt: new Date(),
      },
      update: {
        translatedText: text,
        status: LocalizedTranslationStatus.ready,
        source: LocalizedTranslationSource.manual,
        manualLocked: params.manualLocked !== false,
        basedOnSourceVersion: content.sourceVersion,
        errorMessage: null,
        lastGeneratedAt: new Date(),
      },
    });
  }

  async queueRegeneration(params: {
    context?: RequestContext;
    entityType: LocalizableEntityType;
    entityId: string;
    fieldKey?: string;
    languages?: string[];
    forceManual?: boolean;
  }) {
    const context = params.context || this.tenantContextPort.getRequestContext();
    const policy = await this.getPolicy(context.brandId, context.localId);

    const requestedLanguages = (params.languages || [])
      .map((entry) => normalizeLanguageCode(entry))
      .filter(Boolean);

    const contents = await this.prisma.localizedContent.findMany({
      where: {
        brandId: context.brandId,
        localId: context.localId,
        entityType: params.entityType,
        entityId: params.entityId,
        ...(params.fieldKey ? { fieldKey: params.fieldKey } : {}),
      },
      select: {
        id: true,
        sourceLanguage: true,
        sourceVersion: true,
      },
    });

    if (contents.length === 0) {
      return { queued: 0, skippedManual: 0 };
    }

    let queued = 0;
    let skippedManual = 0;

    for (const content of contents) {
      const targetLanguages =
        requestedLanguages.length > 0
          ? requestedLanguages.filter((language) => language !== content.sourceLanguage)
          : policy.supportedLanguages.filter((language) => language !== content.sourceLanguage);

      if (targetLanguages.length === 0) continue;

      const existing = await this.prisma.localizedContentTranslation.findMany({
        where: {
          contentId: content.id,
          language: { in: targetLanguages },
        },
        select: {
          language: true,
          manualLocked: true,
        },
      });

      const existingByLanguage = new Map(existing.map((row) => [row.language, row]));

      const toCreate: Prisma.LocalizedContentTranslationCreateManyInput[] = [];
      const toUpdate: string[] = [];

      for (const language of targetLanguages) {
        const current = existingByLanguage.get(language);
        if (!current) {
          toCreate.push({
            contentId: content.id,
            brandId: context.brandId,
            localId: context.localId,
            language,
            translatedText: '',
            status: LocalizedTranslationStatus.pending,
            source: LocalizedTranslationSource.ai,
            manualLocked: false,
            basedOnSourceVersion: content.sourceVersion,
          });
          queued += 1;
          continue;
        }

        if (current.manualLocked && !params.forceManual) {
          skippedManual += 1;
          continue;
        }
        toUpdate.push(language);
      }

      if (toCreate.length > 0) {
        await this.prisma.localizedContentTranslation.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
      }

      if (toUpdate.length > 0) {
        const updateResult = await this.prisma.localizedContentTranslation.updateMany({
          where: {
            contentId: content.id,
            language: { in: toUpdate },
            ...(params.forceManual ? {} : { manualLocked: false }),
          },
          data: {
            status: LocalizedTranslationStatus.pending,
            source: LocalizedTranslationSource.ai,
            basedOnSourceVersion: content.sourceVersion,
            errorMessage: null,
          },
        });
        queued += updateResult.count;
      }
    }

    return { queued, skippedManual };
  }

  async getEntityTranslations(params: {
    context?: RequestContext;
    entityType: LocalizableEntityType;
    entityId: string;
  }) {
    const context = params.context || this.tenantContextPort.getRequestContext();
    const policy = await this.getPolicy(context.brandId, context.localId);

    await this.alignEntitySourceLanguagesToPolicy({
      context,
      policy,
      entityType: params.entityType,
      entityId: params.entityId,
    });

    const rows = await this.prisma.localizedContent.findMany({
      where: {
        brandId: context.brandId,
        localId: context.localId,
        entityType: params.entityType,
        entityId: params.entityId,
      },
      orderBy: [{ fieldKey: 'asc' }],
      include: {
        translations: {
          orderBy: [{ language: 'asc' }],
        },
      },
    });

    return rows.map((row) => ({
      fieldKey: row.fieldKey,
      sourceLanguage: row.sourceLanguage,
      sourceText: row.sourceText,
      sourceVersion: row.sourceVersion,
      translations: row.translations.map((translation) => ({
        language: translation.language,
        translatedText: translation.translatedText,
        status: translation.status,
        source: translation.source,
        manualLocked: translation.manualLocked,
        basedOnSourceVersion: translation.basedOnSourceVersion,
        errorMessage: translation.errorMessage,
        updatedAt: translation.updatedAt,
      })),
    }));
  }

  private async alignEntitySourceLanguagesToPolicy(params: {
    context: RequestContext;
    policy: LocalizationPolicy;
    entityType: LocalizableEntityType;
    entityId: string;
  }) {
    const mismatchedRows = await this.prisma.localizedContent.findMany({
      where: {
        brandId: params.context.brandId,
        localId: params.context.localId,
        entityType: params.entityType,
        entityId: params.entityId,
        sourceLanguage: { not: params.policy.defaultLanguage },
      },
      select: {
        id: true,
        brandId: true,
        localId: true,
        sourceVersion: true,
      },
    });

    if (mismatchedRows.length === 0) return;

    for (const row of mismatchedRows) {
      const nextVersion = row.sourceVersion + 1;

      await this.prisma.localizedContent.update({
        where: { id: row.id },
        data: {
          sourceLanguage: params.policy.defaultLanguage,
          sourceVersion: nextVersion,
        },
      });

      await this.prisma.localizedContentTranslation.updateMany({
        where: {
          contentId: row.id,
          language: { not: params.policy.defaultLanguage },
          manualLocked: false,
        },
        data: {
          status: LocalizedTranslationStatus.pending,
          basedOnSourceVersion: nextVersion,
          errorMessage: null,
        },
      });

      await this.prisma.localizedContentTranslation.updateMany({
        where: {
          contentId: row.id,
          language: { not: params.policy.defaultLanguage },
          manualLocked: true,
        },
        data: {
          status: LocalizedTranslationStatus.stale,
          basedOnSourceVersion: nextVersion,
        },
      });

      await this.prisma.localizedContentTranslation.deleteMany({
        where: {
          contentId: row.id,
          language: params.policy.defaultLanguage,
        },
      });

      await this.ensureMissingTranslationRows({
        content: {
          id: row.id,
          brandId: row.brandId,
          localId: row.localId,
          sourceLanguage: params.policy.defaultLanguage,
          sourceVersion: nextVersion,
        },
        supportedLanguages: params.policy.supportedLanguages,
      });
    }
  }

  async getEntityTranslationSummaries(params: {
    context?: RequestContext;
    entityType: LocalizableEntityType;
    entityIds: string[];
  }) {
    const context = params.context || this.tenantContextPort.getRequestContext();
    const entityIds = Array.from(new Set(params.entityIds.map((entry) => trimText(entry)).filter(Boolean)));
    if (entityIds.length === 0) return [];

    const policy = await this.getPolicy(context.brandId, context.localId);
    const rows = await this.prisma.localizedContent.findMany({
      where: {
        brandId: context.brandId,
        localId: context.localId,
        entityType: params.entityType,
        entityId: { in: entityIds },
      },
      include: {
        translations: {
          select: {
            language: true,
            status: true,
            basedOnSourceVersion: true,
            translatedText: true,
          },
        },
      },
    });

    const rowsByEntity = new Map<string, typeof rows>();
    for (const entityId of entityIds) {
      rowsByEntity.set(entityId, []);
    }
    for (const row of rows) {
      const current = rowsByEntity.get(row.entityId) || [];
      current.push(row);
      rowsByEntity.set(row.entityId, current);
    }

    const resolveSummaryStatus = (counts: {
      failed: number;
      pending: number;
      stale: number;
      missing: number;
      ready: number;
      targetCount: number;
      trackedFieldCount: number;
    }): LocalizationSummaryStatus => {
      if (counts.trackedFieldCount === 0) return 'missing';
      if (counts.failed > 0) return 'failed';
      if (counts.pending > 0) return 'pending';
      if (counts.stale > 0) return 'stale';
      if (counts.missing > 0) return 'missing';
      if (counts.targetCount === 0) return 'ready';
      if (counts.ready >= counts.targetCount) return 'ready';
      return 'missing';
    };

    return entityIds.map((entityId) => {
      const entityRows = rowsByEntity.get(entityId) || [];
      let ready = 0;
      let pending = 0;
      let failed = 0;
      let stale = 0;
      let missing = 0;
      let targetCount = 0;

      for (const row of entityRows) {
        const targetLanguages = policy.supportedLanguages.filter((language) => language !== row.sourceLanguage);
        const translationsByLanguage = new Map(row.translations.map((translation) => [translation.language, translation]));
        targetCount += targetLanguages.length;

        for (const language of targetLanguages) {
          const translation = translationsByLanguage.get(language);
          if (!translation) {
            missing += 1;
            continue;
          }

          if (translation.status === LocalizedTranslationStatus.failed) {
            failed += 1;
            continue;
          }
          if (translation.status === LocalizedTranslationStatus.pending) {
            pending += 1;
            continue;
          }
          if (translation.status === LocalizedTranslationStatus.stale) {
            stale += 1;
            continue;
          }
          if (translation.status === LocalizedTranslationStatus.ready) {
            const hasText = trimText(translation.translatedText).length > 0;
            const matchesVersion = translation.basedOnSourceVersion === row.sourceVersion;
            if (!hasText || !matchesVersion) {
              stale += 1;
              continue;
            }
            ready += 1;
            continue;
          }
          missing += 1;
        }
      }

      const trackedFieldCount = entityRows.length;
      return {
        entityId,
        status: resolveSummaryStatus({
          failed,
          pending,
          stale,
          missing,
          ready,
          targetCount,
          trackedFieldCount,
        }),
        trackedFieldCount,
        targetCount,
        readyCount: ready,
        pendingCount: pending,
        failedCount: failed,
        staleCount: stale,
        missingCount: missing,
      };
    });
  }

  async processPendingTranslations(limit = 30) {
    const pendingRows = await this.prisma.localizedContentTranslation.findMany({
      where: {
        status: LocalizedTranslationStatus.pending,
        manualLocked: false,
      },
      include: {
        content: true,
      },
      orderBy: [{ updatedAt: 'asc' }],
      take: limit,
    });

    let processed = 0;
    let failed = 0;
    const usageCache = new Map<string, MonthlyUsage>();

    for (const row of pendingRows) {
      const sourceText = trimText(row.content.sourceText);
      if (!sourceText) {
        await this.markFailed(row.id, 'SOURCE_TEXT_EMPTY');
        failed += 1;
        continue;
      }

      if (row.language === row.content.sourceLanguage) {
        await this.prisma.localizedContentTranslation.update({
          where: { id: row.id },
          data: {
            translatedText: sourceText,
            status: LocalizedTranslationStatus.ready,
            source: LocalizedTranslationSource.manual,
            basedOnSourceVersion: row.content.sourceVersion,
            errorMessage: null,
            lastGeneratedAt: new Date(),
          },
        });
        processed += 1;
        continue;
      }

      const policy = await this.getPolicy(row.brandId, row.localId || undefined);
      if (!policy.autoTranslateEnabled || policy.autoTranslatePaused) continue;

      if (!policy.supportedLanguages.includes(row.language)) {
        await this.markFailed(row.id, `LANGUAGE_NOT_ENABLED:${row.language}`);
        failed += 1;
        continue;
      }

      const usageKey = `${row.brandId}:${row.localId || 'brand'}`;
      if (policy.monthlyRequestLimit || policy.monthlyCharacterLimit) {
        const usage =
          usageCache.get(usageKey) ||
          (await this.loadMonthlyUsage({
            brandId: row.brandId,
            localId: row.localId || null,
          }));
        usageCache.set(usageKey, usage);

        if (policy.monthlyRequestLimit && usage.requests >= policy.monthlyRequestLimit) {
          await this.markFailed(row.id, 'AUTO_TRANSLATE_REQUEST_LIMIT_REACHED');
          failed += 1;
          continue;
        }
        if (
          policy.monthlyCharacterLimit &&
          usage.characters + sourceText.length > policy.monthlyCharacterLimit
        ) {
          await this.markFailed(row.id, 'AUTO_TRANSLATE_CHARACTER_LIMIT_REACHED');
          failed += 1;
          continue;
        }
      }

      const brandConfig = await this.tenantConfig.getBrandConfig(row.brandId);
      const provider = (brandConfig.ai?.provider || 'openai').toLowerCase();
      if (provider !== 'openai') {
        await this.markFailed(row.id, `UNSUPPORTED_PROVIDER:${provider}`);
        failed += 1;
        continue;
      }

      const apiKey = trimText(brandConfig.ai?.apiKey);
      const model = trimText(brandConfig.ai?.model) || 'gpt-4o-mini';
      if (!apiKey) {
        await this.markFailed(row.id, 'AI_API_KEY_MISSING');
        failed += 1;
        continue;
      }

      let translatedText = '';
      let lastError = '';
      const maxAttempts = Math.max(1, policy.retryAttempts);

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const result = await this.translationProvider.translateText({
            apiKey,
            model,
            sourceLanguage: row.content.sourceLanguage,
            targetLanguage: row.language,
            text: sourceText,
          });
          translatedText = trimText(result.translatedText);
          if (!translatedText) {
            throw new Error('TRANSLATION_EMPTY');
          }
          lastError = '';
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      if (!translatedText) {
        this.logger.warn(
          `Translation failed contentId=${row.contentId} language=${row.language}: ${lastError}`,
        );
        await this.markFailed(row.id, lastError || 'TRANSLATION_FAILED');
        failed += 1;
        await this.maybeOpenCircuitBreaker({
          brandId: row.brandId,
          localId: row.localId || null,
          policy,
        });
        continue;
      }

      await this.prisma.localizedContentTranslation.update({
        where: { id: row.id },
        data: {
          translatedText,
          status: LocalizedTranslationStatus.ready,
          source: LocalizedTranslationSource.ai,
          basedOnSourceVersion: row.content.sourceVersion,
          provider,
          model,
          errorMessage: null,
          lastGeneratedAt: new Date(),
        },
      });
      const usage = usageCache.get(usageKey);
      if (usage) {
        usage.requests += 1;
        usage.characters += translatedText.length;
        usageCache.set(usageKey, usage);
      }
      processed += 1;
    }

    return {
      picked: pendingRows.length,
      processed,
      failed,
    };
  }

  private async markFailed(translationId: string, reason: string) {
    await this.prisma.localizedContentTranslation.update({
      where: { id: translationId },
      data: {
        status: LocalizedTranslationStatus.failed,
        errorMessage: reason.slice(0, 2000),
      },
    });
  }

  private async loadMonthlyUsage(params: {
    brandId: string;
    localId: string | null;
  }): Promise<MonthlyUsage> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const generated = await this.prisma.localizedContentTranslation.findMany({
      where: {
        brandId: params.brandId,
        localId: params.localId,
        source: LocalizedTranslationSource.ai,
        lastGeneratedAt: { gte: monthStart },
      },
      select: {
        translatedText: true,
      },
    });
    return {
      requests: generated.length,
      characters: generated.reduce((acc, row) => acc + trimText(row.translatedText).length, 0),
    };
  }

  private async maybeOpenCircuitBreaker(params: {
    brandId: string;
    localId: string | null;
    policy: LocalizationPolicy;
  }): Promise<void> {
    if (!params.policy.circuitBreaker.enabled) return;
    const windowStart = new Date(
      Date.now() - params.policy.circuitBreaker.windowMinutes * 60_000,
    );
    const samples = await this.prisma.localizedContentTranslation.findMany({
      where: {
        brandId: params.brandId,
        localId: params.localId,
        source: LocalizedTranslationSource.ai,
        updatedAt: { gte: windowStart },
        status: {
          in: [LocalizedTranslationStatus.ready, LocalizedTranslationStatus.failed],
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: Math.max(params.policy.circuitBreaker.minSamples * 2, 120),
      select: {
        status: true,
      },
    });

    if (samples.length === 0) return;

    const failures = samples.filter(
      (entry) => entry.status === LocalizedTranslationStatus.failed,
    ).length;
    const failureRate = failures / samples.length;

    let consecutiveFailures = 0;
    for (const entry of samples) {
      if (entry.status !== LocalizedTranslationStatus.failed) break;
      consecutiveFailures += 1;
    }

    const shouldOpen =
      (samples.length >= params.policy.circuitBreaker.minSamples &&
        failureRate >= params.policy.circuitBreaker.failureRateThreshold) ||
      consecutiveFailures >= params.policy.circuitBreaker.consecutiveFailures;

    if (!shouldOpen) return;

    const pauseUntil = new Date(
      Date.now() + params.policy.circuitBreaker.pauseMinutes * 60_000,
    ).toISOString();
    await this.setAutoTranslatePause({
      brandId: params.brandId,
      localId: params.localId,
      pauseUntil,
      reason: `AUTO_CIRCUIT_BREAKER(rate=${failureRate.toFixed(3)},consecutive=${consecutiveFailures})`,
    });

    this.logger.warn(
      `Auto-translate circuit opened brandId=${params.brandId} localId=${params.localId || 'brand'} rate=${failureRate.toFixed(3)} consecutive=${consecutiveFailures} pauseUntil=${pauseUntil}`,
    );
  }

  private async setAutoTranslatePause(params: {
    brandId: string;
    localId: string | null;
    pauseUntil: string;
    reason: string;
  }): Promise<void> {
    if (params.localId) {
      const current = await this.prisma.locationConfig.findUnique({
        where: { localId: params.localId },
        select: { data: true },
      });
      const currentData = (current?.data || {}) as Record<string, unknown>;
      const nextData = this.mergeAutoTranslateConfig(currentData, {
        paused: true,
        pauseUntil: params.pauseUntil,
        pauseReason: params.reason.slice(0, 240),
      });
      await this.prisma.locationConfig.upsert({
        where: { localId: params.localId },
        create: { localId: params.localId, data: nextData as Prisma.InputJsonValue },
        update: { data: nextData as Prisma.InputJsonValue },
      });
      return;
    }

    const current = await this.prisma.brandConfig.findUnique({
      where: { brandId: params.brandId },
      select: { data: true },
    });
    const currentData = (current?.data || {}) as Record<string, unknown>;
    const nextData = this.mergeAutoTranslateConfig(currentData, {
      paused: true,
      pauseUntil: params.pauseUntil,
      pauseReason: params.reason.slice(0, 240),
    });
    await this.prisma.brandConfig.upsert({
      where: { brandId: params.brandId },
      create: { brandId: params.brandId, data: nextData as Prisma.InputJsonValue },
      update: { data: nextData as Prisma.InputJsonValue },
    });
  }

  private mergeAutoTranslateConfig(
    rootConfig: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const i18n =
      rootConfig.i18n && typeof rootConfig.i18n === 'object' && !Array.isArray(rootConfig.i18n)
        ? (rootConfig.i18n as Record<string, unknown>)
        : {};
    const autoTranslate =
      i18n.autoTranslate &&
      typeof i18n.autoTranslate === 'object' &&
      !Array.isArray(i18n.autoTranslate)
        ? (i18n.autoTranslate as Record<string, unknown>)
        : {};

    return {
      ...rootConfig,
      i18n: {
        ...i18n,
        autoTranslate: {
          ...autoTranslate,
          ...patch,
        },
      },
    };
  }

  private async ensureMissingTranslationRows(params: {
    content: {
      id: string;
      brandId: string;
      localId: string | null;
      sourceLanguage: string;
      sourceVersion: number;
      translations?: Array<{ language: string }>;
    };
    supportedLanguages: string[];
  }) {
    const languagesToCreate = params.supportedLanguages.filter((language) => language !== params.content.sourceLanguage);
    if (languagesToCreate.length === 0) return;

    const existing =
      params.content.translations ||
      (await this.prisma.localizedContentTranslation.findMany({
        where: { contentId: params.content.id },
        select: { language: true },
      }));

    const existingLanguages = new Set(existing.map((entry) => entry.language));
    const missing = languagesToCreate.filter((language) => !existingLanguages.has(language));

    if (missing.length === 0) return;

    await this.prisma.localizedContentTranslation.createMany({
      data: missing.map((language) => ({
        contentId: params.content.id,
        brandId: params.content.brandId,
        localId: params.content.localId,
        language,
        translatedText: '',
        status: LocalizedTranslationStatus.pending,
        source: LocalizedTranslationSource.ai,
        manualLocked: false,
        basedOnSourceVersion: params.content.sourceVersion,
      })),
      skipDuplicates: true,
    });
  }

  private async ensureSourceRowsFromItems<T extends { id: string }>(params: {
    context: RequestContext;
    policy: LocalizationPolicy;
    entityType: LocalizableEntityType;
    items: T[];
    descriptors: LocalizedFieldDescriptor<T>[];
  }) {
    const scope = params.context.localId ? LocalizedContentScope.location : LocalizedContentScope.brand;
    const entityIds = params.items.map((item) => item.id);
    const fieldKeys = params.descriptors.map((descriptor) => descriptor.fieldKey);

    const existingRows = await this.prisma.localizedContent.findMany({
      where: {
        brandId: params.context.brandId,
        localId: params.context.localId,
        entityType: params.entityType,
        entityId: { in: entityIds },
        fieldKey: { in: fieldKeys },
      },
      select: {
        id: true,
        entityId: true,
        fieldKey: true,
        sourceLanguage: true,
        sourceVersion: true,
        brandId: true,
        localId: true,
      },
    });

    const existingKeys = new Set(existingRows.map((row) => `${row.entityId}:${row.fieldKey}`));

    for (const item of params.items) {
      for (const descriptor of params.descriptors) {
        const key = `${item.id}:${descriptor.fieldKey}`;
        if (existingKeys.has(key)) continue;
        const sourceText = trimText(descriptor.getValue(item));
        if (!sourceText) continue;

        try {
          const created = await this.prisma.localizedContent.create({
            data: {
              scope,
              brandId: params.context.brandId,
              localId: params.context.localId,
              entityType: params.entityType,
              entityId: item.id,
              fieldKey: descriptor.fieldKey,
              sourceLanguage: params.policy.defaultLanguage,
              sourceText,
              sourceHash: hashText(sourceText),
              sourceVersion: 1,
            },
          });
          await this.ensureMissingTranslationRows({
            content: created,
            supportedLanguages: params.policy.supportedLanguages,
          });
        } catch (error) {
          const isUniqueError =
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
          if (!isUniqueError) throw error;
        }
        existingKeys.add(key);
      }
    }
  }

  private async getPolicy(brandId: string, localId?: string): Promise<LocalizationPolicy> {
    const [brandConfig, locationConfig] = await Promise.all([
      this.tenantConfig.getBrandConfig(brandId),
      localId ? this.tenantConfig.getLocationConfig(localId) : Promise.resolve({}),
    ]);

    const brandDefault = normalizeLanguageCode(brandConfig?.i18n?.defaultLanguage) || DEFAULT_LANGUAGE;
    const locationDefault = normalizeLanguageCode((locationConfig as any)?.i18n?.defaultLanguage);
    const defaultLanguage = locationDefault || brandDefault;

    const mergedSupported = Array.from(
      new Set([
        defaultLanguage,
        ...((brandConfig?.i18n?.supportedLanguages || []).map((entry) => normalizeLanguageCode(entry))),
        ...((((locationConfig as any)?.i18n?.supportedLanguages || []) as string[]).map((entry) => normalizeLanguageCode(entry))),
      ].filter(Boolean)),
    );

    const toPositiveInt = (value: unknown, min: number, max: number) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return undefined;
      const rounded = Math.round(parsed);
      if (rounded < min || rounded > max) return undefined;
      return rounded;
    };
    const toRatio = (value: unknown, min: number, max: number) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return undefined;
      if (parsed < min || parsed > max) return undefined;
      return parsed;
    };

    const brandAutoRaw = ((brandConfig as any)?.i18n?.autoTranslate || {}) as Record<string, unknown>;
    const locationAutoRaw = (((locationConfig as any)?.i18n?.autoTranslate || {}) as Record<string, unknown>);
    const mergedAutoRaw = {
      ...brandAutoRaw,
      ...locationAutoRaw,
      circuitBreaker: {
        ...((brandAutoRaw.circuitBreaker as Record<string, unknown>) || {}),
        ...((locationAutoRaw.circuitBreaker as Record<string, unknown>) || {}),
      },
    } as Record<string, unknown>;

    const autoTranslateEnabled =
      typeof mergedAutoRaw.enabled === 'boolean'
        ? Boolean(mergedAutoRaw.enabled)
        : true;
    const paused = mergedAutoRaw.paused === true;
    const pauseUntilRaw =
      typeof mergedAutoRaw.pauseUntil === 'string' ? mergedAutoRaw.pauseUntil : null;
    const pauseUntilDate = pauseUntilRaw ? new Date(pauseUntilRaw) : null;
    const pauseUntilActive =
      Boolean(pauseUntilDate && !Number.isNaN(pauseUntilDate.getTime()) && pauseUntilDate > new Date());

    const retryAttempts =
      toPositiveInt(mergedAutoRaw.retryAttempts, 1, 5) || DEFAULT_RETRY_ATTEMPTS;
    const monthlyRequestLimit =
      toPositiveInt(mergedAutoRaw.monthlyRequestLimit, 1, 1_000_000) ||
      DEFAULT_MONTHLY_REQUEST_LIMIT;
    const monthlyCharacterLimit =
      toPositiveInt(mergedAutoRaw.monthlyCharacterLimit, 1, 500_000_000) ||
      DEFAULT_MONTHLY_CHARACTER_LIMIT;

    const circuitBreakerRaw = (mergedAutoRaw.circuitBreaker || {}) as Record<string, unknown>;
    const circuitBreakerEnabled =
      typeof circuitBreakerRaw.enabled === 'boolean'
        ? Boolean(circuitBreakerRaw.enabled)
        : DEFAULT_CIRCUIT_BREAKER.enabled;
    const failureRateThreshold =
      toRatio(circuitBreakerRaw.failureRateThreshold, 0.05, 1) ||
      DEFAULT_CIRCUIT_BREAKER.failureRateThreshold;
    const minSamples =
      toPositiveInt(circuitBreakerRaw.minSamples, 1, 500) ||
      DEFAULT_CIRCUIT_BREAKER.minSamples;
    const consecutiveFailures =
      toPositiveInt(circuitBreakerRaw.consecutiveFailures, 1, 100) ||
      DEFAULT_CIRCUIT_BREAKER.consecutiveFailures;
    const windowMinutes =
      toPositiveInt(circuitBreakerRaw.windowMinutes, 1, 240) ||
      DEFAULT_CIRCUIT_BREAKER.windowMinutes;
    const pauseMinutes =
      toPositiveInt(circuitBreakerRaw.pauseMinutes, 1, 720) ||
      DEFAULT_CIRCUIT_BREAKER.pauseMinutes;

    return {
      defaultLanguage,
      supportedLanguages: mergedSupported.length > 0 ? mergedSupported : [defaultLanguage],
      autoTranslateEnabled,
      autoTranslatePaused: paused || pauseUntilActive,
      autoTranslatePauseUntil: pauseUntilActive ? pauseUntilDate?.toISOString() || null : null,
      retryAttempts,
      monthlyRequestLimit,
      monthlyCharacterLimit,
      circuitBreaker: {
        enabled: circuitBreakerEnabled,
        failureRateThreshold,
        minSamples,
        consecutiveFailures,
        windowMinutes,
        pauseMinutes,
      },
    };
  }

  private resolveRequestedLanguage(context: RequestContext, policy: LocalizationPolicy): string {
    const requested = normalizeLanguageCode(context.requestedLanguage || null);
    if (!requested) return policy.defaultLanguage;
    if (policy.supportedLanguages.includes(requested)) return requested;
    const baseLanguage = requested.split('-')[0];
    if (baseLanguage && policy.supportedLanguages.includes(baseLanguage)) return baseLanguage;
    return policy.defaultLanguage;
  }
}
