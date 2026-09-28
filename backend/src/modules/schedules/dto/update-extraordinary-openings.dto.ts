import { IsObject } from 'class-validator';
import { ExtraordinaryOpeningsByDate } from '../schedule.types';

export class UpdateExtraordinaryOpeningsDto {
  @IsObject()
  extraordinaryOpenings!: ExtraordinaryOpeningsByDate;
}
