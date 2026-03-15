import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../prisma/prisma.service';
import { buildBrandConfigFromEnv, buildLocationConfigFromEnv } from './tenant-config.defaults';
import { BrandConfigData, EffectiveTenantConfig, LocationConfigData, TenantI18nConfig, TenantThemeConfig } from './tenant-config.types';

const mergeConfig = <T extends Record<string, any>>(base: T, override?: Partial<T>) => {
  if (!override) return { ...base };
  const result: any = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeConfig(base?.[key] || {}, value as Record<string, any>);
    } else if (value !== undefined) {
      result[key] = value;
    }
  });
  return result;
};

const normalizeTheme = (theme?: TenantThemeConfig): TenantThemeConfig | undefined => {
  if (!theme) return undefined;
  const primary = typeof theme.primary === 'string' ? theme.primary.trim() : '';
  const rawMode = typeof theme.mode === 'string' ? theme.mode.trim().toLowerCase() : '';
  const mode = rawMode === 'light' || rawMode === 'dark' ? rawMode : undefined;
  const next: TenantThemeConfig = {};
  if (primary) next.primary = primary;
  if (mode) next.mode = mode;
  return Object.keys(next).length ? next : undefined;
};

const normalizeLanguageCode = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase().slice(0, 10) : '';

const toPositiveInt = (value: unknown, min: number, max: number): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  if (rounded < min || rounded > max) return undefined;
  return rounded;
};

const toRatio = (value: unknown, min: number, max: number): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < min || parsed > max) return undefined;
  return parsed;
};

const normalizeI18n = (config?: TenantI18nConfig): TenantI18nConfig | undefined => {
  if (!config) return undefined;
  const defaultLanguage = normalizeLanguageCode(config.defaultLanguage) || 'es';
  const supportedLanguages = Array.from(
    new Set(
      [defaultLanguage, ...(Array.isArray(config.supportedLanguages) ? config.supportedLanguages : [])]
        .map((entry) => normalizeLanguageCode(entry))
        .filter(Boolean),
    ),
  );
  const autoTranslateEnabled =
    typeof config.autoTranslate?.enabled === 'boolean' ? config.autoTranslate.enabled : true;
  const paused = config.autoTranslate?.paused === true;
  const pauseUntil =
    typeof config.autoTranslate?.pauseUntil === 'string' && config.autoTranslate.pauseUntil.trim()
      ? config.autoTranslate.pauseUntil.trim()
      : undefined;
  const pauseReason =
    typeof config.autoTranslate?.pauseReason === 'string' && config.autoTranslate.pauseReason.trim()
      ? config.autoTranslate.pauseReason.trim().slice(0, 240)
      : undefined;
  const retryAttempts = toPositiveInt(config.autoTranslate?.retryAttempts, 1, 5) ?? 2;
  const monthlyRequestLimit = toPositiveInt(config.autoTranslate?.monthlyRequestLimit, 1, 1_000_000);
  const monthlyCharacterLimit = toPositiveInt(config.autoTranslate?.monthlyCharacterLimit, 1, 500_000_000);

  const circuitBreakerEnabled =
    typeof config.autoTranslate?.circuitBreaker?.enabled === 'boolean'
      ? config.autoTranslate.circuitBreaker.enabled
      : true;
  const failureRateThreshold =
    toRatio(config.autoTranslate?.circuitBreaker?.failureRateThreshold, 0.05, 1) ?? 0.6;
  const minSamples = toPositiveInt(config.autoTranslate?.circuitBreaker?.minSamples, 1, 500) ?? 12;
  const consecutiveFailures =
    toPositiveInt(config.autoTranslate?.circuitBreaker?.consecutiveFailures, 1, 100) ?? 6;
  const windowMinutes = toPositiveInt(config.autoTranslate?.circuitBreaker?.windowMinutes, 1, 240) ?? 30;
  const pauseMinutes = toPositiveInt(config.autoTranslate?.circuitBreaker?.pauseMinutes, 1, 720) ?? 30;

  return {
    defaultLanguage,
    supportedLanguages,
    autoTranslate: {
      enabled: autoTranslateEnabled,
      paused,
      ...(pauseUntil ? { pauseUntil } : {}),
      ...(pauseReason ? { pauseReason } : {}),
      retryAttempts,
      ...(monthlyRequestLimit ? { monthlyRequestLimit } : {}),
      ...(monthlyCharacterLimit ? { monthlyCharacterLimit } : {}),
      circuitBreaker: {
        enabled: circuitBreakerEnabled,
        failureRateThreshold,
        minSamples,
        consecutiveFailures,
        windowMinutes,
        pauseMinutes,
      },
    },
  };
};

@Injectable()
export class TenantConfigService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private getBrandId() {
    return this.tenantContextPort.getRequestContext().brandId;
  }

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  async getBrandConfig(brandId = this.getBrandId()): Promise<BrandConfigData> {
    const fallback = buildBrandConfigFromEnv();
    const config = await this.prisma.brandConfig.findUnique({
      where: { brandId },
      select: { data: true },
    });
    if (!config?.data) return fallback;
    const merged = mergeConfig(fallback, config.data as BrandConfigData);
    const smsSenderId = (config.data as BrandConfigData)?.twilio?.smsSenderId?.trim() || undefined;
    return {
      ...merged,
      twilio: {
        ...fallback.twilio,
        ...(smsSenderId ? { smsSenderId } : {}),
      },
    };
  }

  async getLocationConfig(localId = this.getLocalId()): Promise<LocationConfigData> {
    const fallback = buildLocationConfigFromEnv();
    const config = await this.prisma.locationConfig.findUnique({
      where: { localId },
      select: { data: true },
    });
    if (!config?.data) return fallback;
    return mergeConfig(fallback, config.data as LocationConfigData);
  }

  async getEffectiveConfig(): Promise<EffectiveTenantConfig> {
    const [brandConfig, locationConfig] = await Promise.all([
      this.getBrandConfig(),
      this.getLocationConfig(),
    ]);
    const brandTheme = normalizeTheme(brandConfig.theme);
    const locationTheme = normalizeTheme(locationConfig.theme);
    const brandI18n = normalizeI18n(brandConfig.i18n);
    const locationI18n = normalizeI18n(locationConfig.i18n);
    const theme = mergeConfig(brandTheme || {}, locationTheme || {});
    const i18n = normalizeI18n(mergeConfig(brandI18n || {}, locationI18n || {}));
    const effectiveConfig = mergeConfig(brandConfig, locationConfig);
    return {
      ...effectiveConfig,
      theme: Object.keys(theme).length ? theme : undefined,
      i18n,
    };
  }

  async getPublicConfig() {
    const [brandConfig, locationConfig] = await Promise.all([
      this.getBrandConfig(),
      this.getLocationConfig(),
    ]);
    const brandTheme = normalizeTheme(brandConfig.theme);
    const locationTheme = normalizeTheme(locationConfig.theme);
    const theme = mergeConfig(brandTheme || {}, locationTheme || {});
    const adminSidebar = mergeConfig(
      brandConfig.adminSidebar || {},
      locationConfig.adminSidebar || {},
    );
    const notificationPrefs = mergeConfig(
      brandConfig.notificationPrefs || {},
      locationConfig.notificationPrefs || {},
    );
    const branding = mergeConfig(
      brandConfig.branding || {},
      locationConfig.branding || {},
    );
    const landing = mergeConfig(
      brandConfig.landing || {},
      locationConfig.landing || {},
    );
    const i18n = normalizeI18n(
      mergeConfig(
        normalizeI18n(brandConfig.i18n) || {},
        normalizeI18n(locationConfig.i18n) || {},
      ),
    );
    const features = mergeConfig(
      brandConfig.features || {},
      locationConfig.features || {},
    );
    const business = mergeConfig(brandConfig.business || {}, {});
    return {
      branding: Object.keys(branding).length ? branding : null,
      theme: Object.keys(theme).length ? theme : null,
      adminSidebar: Object.keys(adminSidebar).length ? adminSidebar : null,
      notificationPrefs: Object.keys(notificationPrefs).length ? notificationPrefs : null,
      landing: Object.keys(landing).length ? landing : null,
      i18n: i18n || null,
      features: Object.keys(features).length ? features : null,
      business: Object.keys(business).length ? business : null,
    };
  }
}
