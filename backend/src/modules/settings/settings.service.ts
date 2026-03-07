import { Inject, Injectable } from '@nestjs/common';
import { ManagePlatformSettingsUseCase } from '../../contexts/platform/application/use-cases/manage-platform-settings.use-case';
import {
  PLATFORM_SETTINGS_MANAGEMENT_PORT,
  PlatformSettingsManagementPort,
} from '../../contexts/platform/ports/outbound/platform-settings-management.port';
import { SiteSettings } from './settings.types';

@Injectable()
export class SettingsService {
  private readonly managePlatformSettingsUseCase: ManagePlatformSettingsUseCase;

  constructor(
    @Inject(PLATFORM_SETTINGS_MANAGEMENT_PORT)
    private readonly settingsManagementPort: PlatformSettingsManagementPort,
  ) {
    this.managePlatformSettingsUseCase = new ManagePlatformSettingsUseCase(this.settingsManagementPort);
  }

  getSettings(): Promise<SiteSettings> {
    return this.managePlatformSettingsUseCase.getSettings() as Promise<SiteSettings>;
  }

  updateSettings(settings: SiteSettings): Promise<SiteSettings> {
    return this.managePlatformSettingsUseCase.updateSettings(settings) as Promise<SiteSettings>;
  }
}
