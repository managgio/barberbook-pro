import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class PlatformAdminService {
  constructor(
    @Inject(PLATFORM_ADMIN_MANAGEMENT_PORT)
    private readonly platformAdminManagementPort: PlatformAdminManagementPort,
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
    return this.platformAdminManagementPort.createLocation(brandId, data);
  }

  updateLocation(id: string, data: PlatformUpdateLocationInput) {
    return this.platformAdminManagementPort.updateLocation(id, data);
  }

  deleteLocation(id: string) {
    return this.platformAdminManagementPort.deleteLocation(id);
  }

  getBrandConfig(brandId: string) {
    return this.platformAdminManagementPort.getBrandConfig(brandId);
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

  updateBrandConfig(brandId: string, data: Record<string, unknown>) {
    return this.platformAdminManagementPort.updateBrandConfig(brandId, data);
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
