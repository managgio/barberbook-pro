import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  find() {
    return this.settingsService.getSettings();
  }

  @Put()
  update(@Body() body: UpsertSettingsDto) {
    return this.settingsService.updateSettings(body.settings);
  }
}
