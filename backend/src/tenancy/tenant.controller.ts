import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from './tenant-config.service';
import { getCurrentBrandId, getCurrentLocalId, isPlatformRequest } from './tenant.context';

@Controller('tenant')
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  @Get('bootstrap')
  async getBootstrap() {
    const brandId = getCurrentBrandId();
    const localId = getCurrentLocalId();
    const [brand, publicConfig] = await Promise.all([
      this.prisma.brand.findUnique({
        where: { id: brandId },
        include: {
          locations: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, slug: true, isActive: true },
          },
        },
      }),
      this.tenantConfig.getPublicConfig(),
    ]);

    return {
      brand: brand
        ? {
            id: brand.id,
            name: brand.name,
            subdomain: brand.subdomain,
            customDomain: brand.customDomain,
            defaultLocationId: brand.defaultLocationId,
          }
        : null,
      locations: brand?.locations || [],
      currentLocalId: localId,
      isPlatform: isPlatformRequest(),
      config: publicConfig,
    };
  }
}
