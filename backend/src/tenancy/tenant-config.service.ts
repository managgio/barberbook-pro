import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildBrandConfigFromEnv, buildLocationConfigFromEnv } from './tenant-config.defaults';
import { BrandConfigData, EffectiveTenantConfig, LocationConfigData } from './tenant-config.types';
import { getCurrentBrandId, getCurrentLocalId } from './tenant.context';

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

@Injectable()
export class TenantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getBrandConfig(brandId = getCurrentBrandId()): Promise<BrandConfigData> {
    const fallback = buildBrandConfigFromEnv();
    const config = await this.prisma.brandConfig.findUnique({
      where: { brandId },
      select: { data: true },
    });
    if (!config?.data) return fallback;
    return mergeConfig(fallback, config.data as BrandConfigData);
  }

  async getLocationConfig(localId = getCurrentLocalId()): Promise<LocationConfigData> {
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
    return mergeConfig(brandConfig, locationConfig);
  }

  async getPublicConfig() {
    const [brandConfig, locationConfig] = await Promise.all([
      this.getBrandConfig(),
      this.getLocationConfig(),
    ]);
    const theme = mergeConfig(brandConfig.theme || {}, locationConfig.theme || {});
    const adminSidebar = mergeConfig(
      brandConfig.adminSidebar || {},
      locationConfig.adminSidebar || {},
    );
    return {
      branding: brandConfig.branding || null,
      theme: Object.keys(theme).length ? theme : null,
      adminSidebar: Object.keys(adminSidebar).length ? adminSidebar : null,
    };
  }
}
