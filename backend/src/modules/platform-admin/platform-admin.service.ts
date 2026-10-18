import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  PLATFORM_ADMIN_MANAGEMENT_PORT,
  PlatformAdminManagementPort,
  PlatformAssignBrandAdminInput,
  PlatformCreateBrandInput,
  PlatformCreateLocationInput,
  PlatformRemoveBrandAdminInput,
  PlatformUpdateBrandInput,
  PlatformUpdateLocationInput,
} from '../../contexts/platform/ports/outbound/platform-admin-management.port';
import { TenantEmailConnectionVerifier } from '../notifications/tenant-email-connection-verifier.service';
import { SmtpConfigInput } from '../../contexts/engagement/domain/services/smtp-config.policy';
import {
  hasPlatformEmailConnectionChanged,
  preparePlatformConfigUpdate,
  redactPlatformEmailSecret,
  resolvePlatformEmailVerificationConfig,
} from './platform-email-config.policy';
import {
  canonicalizeIanaTimeZone,
  DEFAULT_LOCATION_TIMEZONE,
} from '../../contexts/platform/domain/services/location-timezone.policy';

@Injectable()
export class PlatformAdminService {
  constructor(
    @Inject(PLATFORM_ADMIN_MANAGEMENT_PORT)
    private readonly platformAdminManagementPort: PlatformAdminManagementPort,
    private readonly emailConnectionVerifier: TenantEmailConnectionVerifier,
  ) {}

  listBrands() {
    return this.platformAdminManagementPort.listBrands();
  }

  getBrand(id: string) {
    return this.platformAdminManagementPort.getBrand(id);
  }

  createBrand(data: PlatformCreateBrandInput) {
    return this.platformAdminManagementPort.createBrand(data);
  }

  updateBrand(id: string, data: PlatformUpdateBrandInput) {
    return this.platformAdminManagementPort.updateBrand(id, data);
  }

  deleteBrand(id: string) {
    return this.platformAdminManagementPort.deleteBrand(id);
  }

  listLocations(brandId: string) {
    return this.platformAdminManagementPort.listLocations(brandId);
  }

  createLocation(brandId: string, data: PlatformCreateLocationInput) {
    const timezone = canonicalizeIanaTimeZone(data.timezone ?? DEFAULT_LOCATION_TIMEZONE);
    if (!timezone) {
      throw new BadRequestException('Invalid location timezone');
    }
    return this.platformAdminManagementPort.createLocation(brandId, { ...data, timezone });
  }

  updateLocation(id: string, data: PlatformUpdateLocationInput) {
    if (data.timezone === undefined) {
      return this.platformAdminManagementPort.updateLocation(id, data);
    }
    const timezone = canonicalizeIanaTimeZone(data.timezone);
    if (!timezone) {
      throw new BadRequestException('Invalid location timezone');
    }
    return this.platformAdminManagementPort.updateLocation(id, { ...data, timezone });
  }

  deleteLocation(id: string) {
    return this.platformAdminManagementPort.deleteLocation(id);
  }

  async getBrandConfig(brandId: string) {
    const config = await this.platformAdminManagementPort.getBrandConfig(brandId);
    return redactPlatformEmailSecret(config);
  }

  listBrandAdmins(brandId: string) {
    return this.platformAdminManagementPort.listBrandAdmins(brandId);
  }

  assignBrandAdmin(brandId: string, data: PlatformAssignBrandAdminInput) {
    return this.platformAdminManagementPort.assignBrandAdmin(brandId, data);
  }

  removeBrandAdmin(brandId: string, data: PlatformRemoveBrandAdminInput) {
    return this.platformAdminManagementPort.removeBrandAdmin(brandId, data);
  }

  async updateBrandConfig(brandId: string, data: Record<string, unknown>) {
    const current = await this.platformAdminManagementPort.getBrandConfig(brandId);
    const prepared = preparePlatformConfigUpdate(current, data);
    if (prepared.email && hasPlatformEmailConnectionChanged(current, prepared)) {
      const verification = await this.emailConnectionVerifier.verify(
        resolvePlatformEmailVerificationConfig(current, prepared.email),
      );
      if (!verification.ok) {
        throw new BadRequestException({
          code: verification.code,
          message: verification.message,
          endpoint: verification.endpoint,
        });
      }
    }
    const saved = await this.platformAdminManagementPort.updateBrandConfig(brandId, prepared);
    const persisted = saved && typeof saved === 'object' && 'data' in saved ? saved.data : prepared;
    return redactPlatformEmailSecret(persisted);
  }

  async verifyBrandEmailConfig(brandId: string, email: SmtpConfigInput) {
    const current = await this.platformAdminManagementPort.getBrandConfig(brandId);
    return this.emailConnectionVerifier.verify(
      resolvePlatformEmailVerificationConfig(current, email),
    );
  }

  getLocationConfig(localId: string) {
    return this.platformAdminManagementPort.getLocationConfig(localId);
  }

  updateLocationConfig(localId: string, data: Record<string, unknown>) {
    return this.platformAdminManagementPort.updateLocationConfig(localId, data);
  }

  getUsageMetrics(windowDays: number) {
    return this.platformAdminManagementPort.getUsageMetrics(windowDays);
  }

  refreshUsageMetrics(windowDays: number) {
    return this.platformAdminManagementPort.refreshUsageMetrics(windowDays);
  }

  getBrandHealth(brandId: string) {
    return this.platformAdminManagementPort.getBrandHealth(brandId);
  }
}
