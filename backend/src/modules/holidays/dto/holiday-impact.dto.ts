import { IsIn, IsOptional, IsString } from 'class-validator';
import { HolidayRangeDto } from './holiday-range.dto';

export class HolidayImpactDto extends HolidayRangeDto {
  @IsIn(['general', 'barber'] as const)
  type!: 'general' | 'barber';

  @IsOptional()
  @IsString()
  barberId?: string;
}
