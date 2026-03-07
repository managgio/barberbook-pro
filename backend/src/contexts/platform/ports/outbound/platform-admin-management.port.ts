import { PlatformUsageMetrics } from '../../domain/entities/platform-usage-metrics.entity';

export const PLATFORM_ADMIN_MANAGEMENT_PORT = Symbol('PLATFORM_ADMIN_MANAGEMENT_PORT');

export type PlatformCreateBrandInput = {
  name: string;
  subdomain: string;
  customDomain?: string | null;
  isActive?: boolean;
};

export type PlatformUpdateBrandInput = {
  name?: string;
  subdomain?: string;
  customDomain?: string | null;
  isActive?: boolean;
  defaultLocationId?: string | null;
};

export type PlatformCreateLocationInput = {
  name: string;
  slug?: string | null;
  isActive?: boolean;
};

export type PlatformUpdateLocationInput = {
  name?: string;
  slug?: string | null;
  isActive?: boolean;
};

export type PlatformAssignBrandAdminInput = {
  email: string;
  localId?: string;
  adminRoleId?: string | null;
  applyToAll?: boolean;
};

export type PlatformRemoveBrandAdminInput = {
  userId?: string;
  email?: string;
  localId?: string;
  removeFromAll?: boolean;
};

export interface PlatformAdminManagementPort {
  listBrands(): Promise<unknown>;
  getBrand(brandId: string): Promise<unknown>;
  createBrand(data: PlatformCreateBrandInput): Promise<unknown>;
  updateBrand(brandId: string, data: PlatformUpdateBrandInput): Promise<unknown>;
  deleteBrand(brandId: string): Promise<{ success: boolean }>;
  listLocations(brandId: string): Promise<unknown>;
  createLocation(brandId: string, data: PlatformCreateLocationInput): Promise<unknown>;
  updateLocation(locationId: string, data: PlatformUpdateLocationInput): Promise<unknown>;
  deleteLocation(locationId: string): Promise<{ success: boolean }>;
  getBrandConfig(brandId: string): Promise<unknown>;
  listBrandAdmins(brandId: string): Promise<unknown>;
  assignBrandAdmin(brandId: string, data: PlatformAssignBrandAdminInput): Promise<{ success: boolean }>;
  removeBrandAdmin(brandId: string, data: PlatformRemoveBrandAdminInput): Promise<{ success: boolean }>;
  updateBrandConfig(brandId: string, data: Record<string, unknown>): Promise<unknown>;
  getLocationConfig(locationId: string): Promise<unknown>;
  updateLocationConfig(locationId: string, data: Record<string, unknown>): Promise<unknown>;
  getUsageMetrics(windowDays: number): Promise<PlatformUsageMetrics>;
  refreshUsageMetrics(windowDays: number): Promise<PlatformUsageMetrics>;
  getBrandHealth(brandId: string): Promise<unknown>;
}
