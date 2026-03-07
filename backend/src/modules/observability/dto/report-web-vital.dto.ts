import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  PlatformWebVitalName as WebVitalName,
  PlatformWebVitalRating as WebVitalRating,
} from '../../../contexts/platform/domain/entities/platform-observability.entity';

export { WebVitalName, WebVitalRating };

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
