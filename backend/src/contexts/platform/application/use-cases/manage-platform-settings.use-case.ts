import {
  PlatformSettingsManagementPort,
  PlatformSiteSettings,
} from '../../ports/outbound/platform-settings-management.port';

export class ManagePlatformSettingsUseCase {
  constructor(private readonly settingsManagementPort: PlatformSettingsManagementPort) {}

  getSettings(): Promise<PlatformSiteSettings> {
    return this.settingsManagementPort.getSettings();
  }

  updateSettings(settings: PlatformSiteSettings): Promise<PlatformSiteSettings> {
    return this.settingsManagementPort.updateSettings(settings);
  }
}
