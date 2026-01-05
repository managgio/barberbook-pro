import { IsNotEmptyObject } from 'class-validator';
import { SiteSettings } from '../settings.types';

export class UpsertSettingsDto {
  @IsNotEmptyObject()
  settings!: SiteSettings;
}
