import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  COMMUNICATION_ACTION_TYPES,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_SCOPE_TYPES,
  COMMUNICATION_TEMPLATE_KEYS,
} from '../communications.constants';

export class CommunicationScopeCriteriaDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;

  @IsOptional()
  @IsString()
  barberId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  barberIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appointmentIds?: string[];
}

export class CommunicationHolidayOptionDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsIn(['general', 'barber'] as const)
  type?: 'general' | 'barber';

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsString()
  barberId?: string;
}

export class CommunicationExtraOptionsDto {
  @IsOptional()
  @IsBoolean()
  excludeAlreadyNotified?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommunicationHolidayOptionDto)
  createHoliday?: CommunicationHolidayOptionDto;
}

export class CommunicationPayloadDto {
  @IsIn(COMMUNICATION_ACTION_TYPES)
  actionType!: (typeof COMMUNICATION_ACTION_TYPES)[number];

  @IsIn(COMMUNICATION_SCOPE_TYPES)
  scopeType!: (typeof COMMUNICATION_SCOPE_TYPES)[number];

  @ValidateNested()
  @Type(() => CommunicationScopeCriteriaDto)
  scopeCriteria!: CommunicationScopeCriteriaDto;

  @IsIn(COMMUNICATION_TEMPLATE_KEYS)
  templateKey!: (typeof COMMUNICATION_TEMPLATE_KEYS)[number];

  @IsIn(COMMUNICATION_CHANNELS)
  channel!: (typeof COMMUNICATION_CHANNELS)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalNote?: string;

  @IsOptional()
  @IsDateString()
  scheduleAt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommunicationExtraOptionsDto)
  extraOptions?: CommunicationExtraOptionsDto;
}
