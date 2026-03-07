export const PLATFORM_SETTINGS_MANAGEMENT_PORT = Symbol('PLATFORM_SETTINGS_MANAGEMENT_PORT');

export type PlatformSiteSettings = {
  openingHours: unknown;
  services: {
    barberServiceAssignmentEnabled: boolean;
    [key: string]: unknown;
  };
  products: {
    enabled: boolean;
    categoriesEnabled: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export interface PlatformSettingsManagementPort {
  getSettings(): Promise<PlatformSiteSettings>;
  updateSettings(settings: PlatformSiteSettings): Promise<PlatformSiteSettings>;
}
