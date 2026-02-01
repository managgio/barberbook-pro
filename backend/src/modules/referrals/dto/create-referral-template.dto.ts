import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RewardType } from '@prisma/client';
import { ReferralAntiFraudDto } from './update-referral-config.dto';

export class CreateReferralTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  attributionExpiryDays?: number;

  @IsOptional()
  @IsBoolean()
  newCustomerOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  monthlyMaxRewardsPerReferrer?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedServiceIds?: string[] | null;

  @IsEnum(RewardType)
  rewardReferrerType!: RewardType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardReferrerValue?: number | null;

  @IsOptional()
  @IsString()
  rewardReferrerServiceId?: string | null;

  @IsEnum(RewardType)
  rewardReferredType!: RewardType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardReferredValue?: number | null;

  @IsOptional()
  @IsString()
  rewardReferredServiceId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReferralAntiFraudDto)
  antiFraud?: ReferralAntiFraudDto;
}
