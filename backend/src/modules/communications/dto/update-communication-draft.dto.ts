import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  COMMUNICATION_ACTION_TYPES,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_SCOPE_TYPES,
  COMMUNICATION_TEMPLATE_KEYS,
} from '../communications.constants';
import {
  CommunicationExtraOptionsDto,
  CommunicationScopeCriteriaDto,
} from './communication-payload.dto';

export class UpdateCommunicationDraftDto {
  @IsOptional()
  @IsIn(COMMUNICATION_ACTION_TYPES)
  actionType?: (typeof COMMUNICATION_ACTION_TYPES)[number];

  @IsOptional()
  @IsIn(COMMUNICATION_SCOPE_TYPES)
  scopeType?: (typeof COMMUNICATION_SCOPE_TYPES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => CommunicationScopeCriteriaDto)
  scopeCriteria?: CommunicationScopeCriteriaDto;

  @IsOptional()
  @IsIn(COMMUNICATION_TEMPLATE_KEYS)
  templateKey?: (typeof COMMUNICATION_TEMPLATE_KEYS)[number];

  @IsOptional()
  @IsIn(COMMUNICATION_CHANNELS)
  channel?: (typeof COMMUNICATION_CHANNELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  message?: string;

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
