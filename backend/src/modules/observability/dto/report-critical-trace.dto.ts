import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CriticalTraceLevel,
  CriticalTraceOutcome,
} from '../../../contexts/platform/domain/entities/platform-observability.entity';

export class ReportCriticalTraceDto {
  @IsString() @MaxLength(80) traceId!: string;
  @IsString() @MaxLength(40) category!: string;
  @IsString() @MaxLength(80) stage!: string;
  @IsEnum(CriticalTraceLevel) level!: CriticalTraceLevel;
  @IsEnum(CriticalTraceOutcome) outcome!: CriticalTraceOutcome;
  @IsString() @MaxLength(300) path!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) occurredAt?: number;
  @IsOptional() @IsString() @MaxLength(80) serviceId?: string;
  @IsOptional() @IsString() @MaxLength(80) barberId?: string;
  @IsOptional() @IsString() @MaxLength(80) appointmentId?: string;
  @IsOptional() @IsISO8601() selectedDateTime?: string;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
  @IsOptional() @IsString() @MaxLength(160) errorName?: string;
  @IsOptional() @IsString() @MaxLength(160) errorCode?: string;
  @IsOptional() @IsString() @MaxLength(8000) errorStack?: string;
  @IsOptional() @IsObject() metadata?: Record<string, string | number | boolean | null>;
}
