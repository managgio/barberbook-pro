import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ReviewCopyDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  positiveText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  positiveCta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  negativeText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  negativeCta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  snoozeCta?: string;
}

export class UpdateReviewConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_, value) => value !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  googleReviewUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  cooldownDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  minVisitsToAsk?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(525600)
  showDelayMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxSnoozes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  snoozeHours?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReviewCopyDto)
  copyJson?: ReviewCopyDto;
}
