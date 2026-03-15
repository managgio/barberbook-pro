import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  PLATFORM_SETTINGS_MANAGEMENT_PORT,
  PlatformSettingsManagementPort,
  PlatformSiteSettings,
} from '../../../contexts/platform/ports/outbound/platform-settings-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantConfigService } from '../../../tenancy/tenant-config.service';
import { LocalizationService } from '../../localization/localization.service';
import { cloneSettings, normalizeSettings, SiteSettings } from '../settings.types';

@Injectable()
export class PrismaPlatformSettingsManagementAdapter implements PlatformSettingsManagementPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly localizationService: LocalizationService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private async resolveRuntimeFlags() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const hidden = config.adminSidebar?.hiddenSections;
    const productsEnabled = !Array.isArray(hidden) || !hidden.includes('stock');
    const barberServiceAssignmentPlatformEnabled = config.features?.barberServiceAssignmentEnabled !== false;
    return {
      productsEnabled,
      barberServiceAssignmentPlatformEnabled,
    };
  }

  private async resolveScopedLocalId(): Promise<string> {
    const context = this.tenantContextPort.getRequestContext();
    const localId = context.localId;
    const brandId = context.brandId;

    const scoped = await this.prisma.location.findFirst({
      where: { id: localId, brandId },
      select: { id: true },
    });
    if (scoped) return scoped.id;

    const fallback =
      (await this.prisma.location.findFirst({
        where: { brandId, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })) ||
      (await this.prisma.location.findFirst({
        where: { brandId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }));

    if (!fallback) {
      throw new BadRequestException('No hay un local disponible para este tenant.');
    }
    return fallback.id;
  }

  private async ensureSettings(): Promise<SiteSettings> {
    const localId = await this.resolveScopedLocalId();
    const existing = await this.prisma.siteSettings.findUnique({ where: { localId } });
    if (!existing) {
      const shopSchedule = await this.prisma.shopSchedule.findUnique({ where: { localId } });
      const defaults = normalizeSettings({
        openingHours: (shopSchedule?.data || undefined) as SiteSettings['openingHours'] | undefined,
      });
      await this.prisma.siteSettings.create({ data: { localId, data: defaults } });
      return defaults;
    }
    return normalizeSettings(existing.data as Partial<SiteSettings>);
  }

  async getSettings(): Promise<PlatformSiteSettings> {
    const context = this.tenantContextPort.getRequestContext();
    const [settings, runtimeFlags] = await Promise.all([
      this.ensureSettings(),
      this.resolveRuntimeFlags(),
    ]);
    const normalizedSettings = cloneSettings({
      ...settings,
      services: {
        ...settings.services,
        barberServiceAssignmentEnabled: runtimeFlags.barberServiceAssignmentPlatformEnabled
          ? settings.services.barberServiceAssignmentEnabled
          : false,
      },
      products: { ...settings.products, enabled: runtimeFlags.productsEnabled },
    }) as PlatformSiteSettings;

    const siteSettingsEntityId = context.localId;
    type LocalizableSiteSettings = SiteSettings & { id: string };
    const localizableSettings: LocalizableSiteSettings = {
      id: siteSettingsEntityId,
      ...(normalizedSettings as SiteSettings),
    };

    const localized = (
      await this.localizationService.localizeCollection({
        context,
        entityType: 'site_settings',
        items: [localizableSettings],
        descriptors: [
          {
            fieldKey: 'branding.tagline',
            getValue: (item) => item.branding.tagline,
            setValue: (item, value) => {
              item.branding.tagline = value;
            },
          },
          {
            fieldKey: 'branding.description',
            getValue: (item) => item.branding.description,
            setValue: (item, value) => {
              item.branding.description = value;
            },
          },
          {
            fieldKey: 'location.label',
            getValue: (item) => item.location.label,
            setValue: (item, value) => {
              item.location.label = value;
            },
          },
        ],
      })
    ).items[0];

    const { id: _ignored, ...localizedSettings } = localized as SiteSettings & { id: string };
    return localizedSettings as PlatformSiteSettings;
  }

  async updateSettings(settings: PlatformSiteSettings): Promise<PlatformSiteSettings> {
    const localId = await this.resolveScopedLocalId();
    const context = this.tenantContextPort.getRequestContext();
    const normalized = normalizeSettings(settings as SiteSettings);
    const runtimeFlags = await this.resolveRuntimeFlags();
    normalized.products.enabled = runtimeFlags.productsEnabled;

    if (!runtimeFlags.barberServiceAssignmentPlatformEnabled) {
      const existing = await this.prisma.siteSettings.findUnique({
        where: { localId },
        select: { data: true },
      });
      const existingNormalized = normalizeSettings(
        (existing?.data || undefined) as Partial<SiteSettings> | undefined,
      );
      normalized.services.barberServiceAssignmentEnabled =
        existingNormalized.services.barberServiceAssignmentEnabled;
    }

    if (normalized.products.categoriesEnabled) {
      const uncategorizedProducts = await this.prisma.product.count({
        where: { categoryId: null, localId },
      });
      if (uncategorizedProducts > 0) {
        throw new BadRequestException(
          'Asigna una categoría a todos los productos antes de activar la categorización.',
        );
      }
    }

    await this.prisma.siteSettings.upsert({
      where: { localId },
      update: { data: normalized },
      create: { localId, data: normalized },
    });
    await this.prisma.shopSchedule.upsert({
      where: { localId },
      update: { data: normalized.openingHours },
      create: { localId, data: normalized.openingHours },
    });
    await this.localizationService.syncEntitySourceFields({
      context: {
        ...context,
        localId,
      },
      entityType: 'site_settings',
      entityId: localId,
      fields: {
        'branding.tagline': normalized.branding.tagline,
        'branding.description': normalized.branding.description,
        'location.label': normalized.location.label,
      },
    });
    return this.getSettings();
  }
}

export const PrismaPlatformSettingsManagementAdapterProvider = {
  provide: PLATFORM_SETTINGS_MANAGEMENT_PORT,
  useExisting: PrismaPlatformSettingsManagementAdapter,
};
