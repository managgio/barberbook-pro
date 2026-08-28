import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class HolidayClosureActionDto {
  @IsIn(['general', 'barber'] as const)
  type!: 'general' | 'barber';

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsOptional()
  @IsString()
  barberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
