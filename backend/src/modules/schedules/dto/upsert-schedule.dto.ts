import { IsNotEmptyObject } from 'class-validator';
import { ShopSchedule } from '../schedule.types';

export class UpsertScheduleDto {
  @IsNotEmptyObject()
  schedule!: ShopSchedule;
}
