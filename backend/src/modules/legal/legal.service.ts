import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ConsentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentBrandId, getCurrentLocalId } from '../../tenancy/tenant.context';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DEFAULT_AI_PROVIDERS, DEFAULT_SUBPROCESSORS } from './legal.constants';
import { buildLegalContent } from './legal-content.builder';
import { UpdateLegalSettingsDto } from './dto/update-legal-settings.dto';
import {
  LegalContentResponse,
  LegalCustomSections,
  LegalPageType,
  LegalSection,
  LegalSettingsResolved,
  LegalSubProcessor,
} from './legal.types';

const normalizeOptionalString = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCountry = (value?: string | null) => {
  if (value === undefined || value === null) return value ?? undefined;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed.slice(0, 2) : undefined;
};

const sanitizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
};

const sanitizeSubProcessors = (value: unknown): LegalSubProcessor[] => {
  if (!Array.isArray(value)) return [];
  const sanitized = value.map((entry): LegalSubProcessor | null => {
      if (!entry || typeof entry !== 'object') return null;
      const data = entry as Record<string, unknown>;
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      const purpose = typeof data.purpose === 'string' ? data.purpose.trim() : '';
      const country = typeof data.country === 'string' ? data.country.trim() : '';
      const dataTypes = typeof data.dataTypes === 'string' ? data.dataTypes.trim() : '';
      const linkRaw = typeof data.link === 'string' ? data.link.trim() : '';
      const link = linkRaw.length > 0 ? linkRaw : null;
      if (!name || !purpose || !country || !dataTypes) return null;
      return { name, purpose, country, dataTypes, link };
    });
  return sanitized.filter((entry): entry is LegalSubProcessor => Boolean(entry));
};

const sanitizeCustomSections = (value: unknown): LegalCustomSections => {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const sanitizeSections = (sections: unknown): LegalCustomSections[keyof LegalCustomSections] => {
    if (!Array.isArray(sections)) return undefined;
    const sanitized = sections.map((section): LegalSection | null => {
        if (!section || typeof section !== 'object') return null;
        const data = section as Record<string, unknown>;
        const heading = typeof data.heading === 'string' ? data.heading.trim() : '';
        const bodyMarkdown = typeof data.bodyMarkdown === 'string' ? data.bodyMarkdown.trim() : '';
        if (!heading || !bodyMarkdown) return null;
        return { heading, bodyMarkdown };
      });
    return sanitized.filter((section): section is LegalSection => Boolean(section));
  };

  return {
    privacy: sanitizeSections(raw.privacy),
    cookies: sanitizeSections(raw.cookies),
    notice: sanitizeSections(raw.notice),
    dpa: sanitizeSections(raw.dpa),
  };
};

const clampRetentionDays = (value: number | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value > 0 ? value : null;
};

@Injectable()
export class LegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getSettings(
    brandId = getCurrentBrandId(),
    localId?: string | null,
  ): Promise<LegalSettingsResolved> {
    const resolvedLocalId = localId === undefined ? getCurrentLocalId() : localId;
    const settings = await this.ensureSettings(brandId, resolvedLocalId || undefined);
    return this.resolveSettings(settings, brandId, resolvedLocalId || undefined);
  }

  async updateSettings(
    brandId = getCurrentBrandId(),
    data: UpdateLegalSettingsDto,
    actorUserId?: string | null,
    localId?: string | null,
  ): Promise<LegalSettingsResolved> {
    const resolvedLocalId = localId === undefined ? getCurrentLocalId() : localId;
    await this.ensureSettings(brandId, resolvedLocalId || undefined);

    const payload: Prisma.BrandLegalSettingsUpdateInput = {
      legalOwnerName: normalizeOptionalString(data.legalOwnerName),
      legalOwnerTaxId: normalizeOptionalString(data.legalOwnerTaxId),
      legalOwnerAddress: normalizeOptionalString(data.legalOwnerAddress),
      legalContactEmail: normalizeOptionalString(data.legalContactEmail),
      legalContactPhone: normalizeOptionalString(data.legalContactPhone),
      country: normalizeCountry(data.country),
      privacyPolicyVersion: data.privacyPolicyVersion,
      cookiePolicyVersion: data.cookiePolicyVersion,
      legalNoticeVersion: data.legalNoticeVersion,
      aiDisclosureEnabled: data.aiDisclosureEnabled,
      aiProviderNames: data.aiProviderNames ? sanitizeStringArray(data.aiProviderNames) : undefined,
      subProcessors: data.subProcessors ? sanitizeSubProcessors(data.subProcessors) : undefined,
      optionalCustomSections: data.optionalCustomSections ? sanitizeCustomSections(data.optionalCustomSections) : undefined,
      retentionDays: clampRetentionDays(data.retentionDays),
    };

    if (payload.aiDisclosureEnabled === true && Array.isArray(payload.aiProviderNames) && payload.aiProviderNames.length === 0) {
      payload.aiProviderNames = DEFAULT_AI_PROVIDERS;
    }

    const updated = await this.prisma.brandLegalSettings.update({
      where: { brandId },
      data: payload,
    });

    await this.auditLogs.log({
      brandId,
      locationId: resolvedLocalId || null,
      actorUserId: actorUserId || null,
      action: 'legal.settings.updated',
      entityType: 'brandLegalSettings',
      entityId: updated.id,
    });

    return this.resolveSettings(updated, brandId, resolvedLocalId || undefined);
  }

  async getPolicyContent(
    type: LegalPageType,
    brandId = getCurrentBrandId(),
    localId = getCurrentLocalId(),
  ): Promise<LegalContentResponse> {
    const settings = await this.getSettings(brandId, localId);
    return buildLegalContent(type, settings, settings.optionalCustomSections);
  }

  async recordPrivacyConsent(params: {
    bookingId: string;
    locationId?: string | null;
    consentGiven: boolean;
    ip?: string | null;
    userAgent?: string | null;
    actorUserId?: string | null;
  }) {
    const brandId = getCurrentBrandId();
    const locationId = params.locationId ?? getCurrentLocalId();
    const settings = await this.getSettings(brandId, locationId);
    const policyVersion = settings.privacyPolicyVersion;
    const consentTextSnapshot = `Acepta la Politica de privacidad v${policyVersion}`;

    const salt = process.env.IP_HASH_SALT?.trim();
    const ipHash = params.ip && salt ? createHash('sha256').update(`${params.ip}${salt}`).digest('hex') : null;
    const userAgent = params.userAgent ? params.userAgent.slice(0, 180) : null;

    const consent = await this.prisma.consentRecord.create({
      data: {
        brandId,
        locationId,
        bookingId: params.bookingId,
        consentType: ConsentType.PRIVACY,
        policyVersion,
        consentGiven: params.consentGiven,
        consentTextSnapshot,
        ipHash,
        userAgent,
      },
    });

    await this.auditLogs.log({
      brandId,
      locationId,
      actorUserId: params.actorUserId || null,
      action: 'consent.created',
      entityType: 'appointment',
      entityId: params.bookingId,
      metadata: { consentType: 'PRIVACY', policyVersion, ipStored: Boolean(ipHash) },
    });

    return consent;
  }

  async hasUserPrivacyConsent(userId: string, policyVersion?: number, brandId = getCurrentBrandId()): Promise<boolean> {
    const version =
      policyVersion ??
      (await this.getSettings(brandId)).privacyPolicyVersion;
    const consent = await this.prisma.consentRecord.findFirst({
      where: {
        brandId,
        consentType: ConsentType.PRIVACY,
        consentGiven: true,
        policyVersion: version,
        appointment: {
          userId,
        },
      },
      select: { id: true },
    });
    return Boolean(consent);
  }

  async getDpaContent(brandId: string): Promise<LegalContentResponse> {
    const settings = await this.getSettings(brandId, null);
    return buildLegalContent('dpa', settings, settings.optionalCustomSections);
  }

  private async ensureSettings(brandId: string, localId?: string): Promise<Prisma.BrandLegalSettingsGetPayload<{}>> {
    const existing = await this.prisma.brandLegalSettings.findUnique({ where: { brandId } });
    if (existing) return existing;

    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true, defaultLocationId: true },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const fallbackLocalId = localId || brand.defaultLocationId || undefined;
    const siteSettings = fallbackLocalId
      ? await this.prisma.siteSettings.findUnique({
          where: { localId: fallbackLocalId },
          select: { data: true },
        })
      : null;
    const contactData = (siteSettings?.data as { contact?: { email?: string; phone?: string } } | undefined)?.contact;

    try {
      return await this.prisma.brandLegalSettings.create({
        data: {
          brandId,
          legalOwnerName: brand.name,
          legalContactEmail: contactData?.email || null,
          legalContactPhone: contactData?.phone || null,
          aiDisclosureEnabled: true,
          aiProviderNames: DEFAULT_AI_PROVIDERS,
          subProcessors: DEFAULT_SUBPROCESSORS,
          optionalCustomSections: {},
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingSettings = await this.prisma.brandLegalSettings.findUnique({ where: { brandId } });
        if (existingSettings) return existingSettings;
      }
      throw error;
    }
  }

  private async resolveSettings(
    settings: Prisma.BrandLegalSettingsGetPayload<{}>,
    brandId: string,
    localId?: string,
  ): Promise<LegalSettingsResolved> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true, defaultLocationId: true },
    });
    const fallbackLocalId = localId || brand?.defaultLocationId || undefined;
    const siteSettings = fallbackLocalId
      ? await this.prisma.siteSettings.findUnique({
          where: { localId: fallbackLocalId },
          select: { data: true },
        })
      : null;
    const contactData = (siteSettings?.data as { contact?: { email?: string; phone?: string } } | undefined)?.contact;

    const aiProviderNames = sanitizeStringArray(settings.aiProviderNames);
    const hasSubProcessors = Array.isArray(settings.subProcessors);
    const subProcessors = sanitizeSubProcessors(settings.subProcessors);
    const optionalCustomSections = sanitizeCustomSections(settings.optionalCustomSections);

    const aiDisclosureEnabled = settings.aiDisclosureEnabled !== false;
    const resolvedAiProviders =
      aiDisclosureEnabled && aiProviderNames.length === 0 ? DEFAULT_AI_PROVIDERS : aiProviderNames;

    const resolvedSubProcessors = hasSubProcessors ? subProcessors : DEFAULT_SUBPROCESSORS;

    return {
      brandId,
      ownerName: settings.legalOwnerName || brand?.name || 'Titular pendiente',
      taxId: settings.legalOwnerTaxId || null,
      address: settings.legalOwnerAddress || null,
      contactEmail: settings.legalContactEmail || contactData?.email || null,
      contactPhone: settings.legalContactPhone || contactData?.phone || null,
      country: settings.country || 'ES',
      privacyPolicyVersion: settings.privacyPolicyVersion || 1,
      cookiePolicyVersion: settings.cookiePolicyVersion || 1,
      legalNoticeVersion: settings.legalNoticeVersion || 1,
      aiDisclosureEnabled,
      aiProviderNames: resolvedAiProviders,
      subProcessors: resolvedSubProcessors,
      optionalCustomSections,
      retentionDays: settings.retentionDays ?? null,
      updatedAt: settings.updatedAt,
    };
  }
}
