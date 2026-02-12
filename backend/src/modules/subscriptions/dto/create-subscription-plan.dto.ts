import { SubscriptionDurationUnit } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string | null;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(1)
  durationValue!: number;

  @IsEnum(SubscriptionDurationUnit)
  durationUnit!: SubscriptionDurationUnit;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsDateString()
  availabilityStartDate?: string | null;

  @IsOptional()
  @IsDateString()
  availabilityEndDate?: string | null;
}
