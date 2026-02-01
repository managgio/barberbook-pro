import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUrl, MaxLength, Min, ValidateIf } from 'class-validator';

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
  @ValidateIf((_, value) => value !== '')
  @IsUrl()
  googleReviewUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cooldownDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minVisitsToAsk?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  showDelayMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSnoozes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  snoozeHours?: number;

  @IsOptional()
  @IsObject()
  copyJson?: ReviewCopyDto;
}
