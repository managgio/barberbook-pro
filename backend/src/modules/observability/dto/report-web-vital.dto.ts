import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export enum WebVitalName {
  LCP = 'LCP',
  CLS = 'CLS',
  INP = 'INP',
  FCP = 'FCP',
  TTFB = 'TTFB',
}

export enum WebVitalRating {
  GOOD = 'good',
  NEEDS_IMPROVEMENT = 'needs-improvement',
  POOR = 'poor',
}

export class ReportWebVitalDto {
  @IsEnum(WebVitalName)
  name!: WebVitalName;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;

  @IsEnum(WebVitalRating)
  rating!: WebVitalRating;

  @IsString()
  @MaxLength(300)
  path!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  timestamp?: number;
}
