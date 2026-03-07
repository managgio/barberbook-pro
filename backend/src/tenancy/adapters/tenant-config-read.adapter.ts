import { Injectable } from '@nestjs/common';
import {
  TenantBrandConfigReadModel,
  TenantConfigReadPort,
  TenantEffectiveConfigReadModel,
} from '../../shared/application/tenant-config-read.port';
import { TenantConfigService } from '../tenant-config.service';

@Injectable()
export class TenantConfigReadAdapter implements TenantConfigReadPort {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async getEffectiveConfig(): Promise<TenantEffectiveConfigReadModel> {
    const config = await this.tenantConfigService.getEffectiveConfig();
    return {
      business: config.business,
      notificationPrefs: config.notificationPrefs,
    };
  }

  async getBrandConfig(brandId: string): Promise<TenantBrandConfigReadModel> {
    const config = await this.tenantConfigService.getBrandConfig(brandId);
    return {
      firebaseAdmin: config.firebaseAdmin ?? null,
    };
  }
}
