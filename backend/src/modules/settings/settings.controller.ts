import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  find() {
    return this.settingsService.getSettings();
  }

  @Put()
  @AdminEndpoint()
  update(@Body() body: UpsertSettingsDto) {
    return this.settingsService.updateSettings(body.settings);
  }
}
