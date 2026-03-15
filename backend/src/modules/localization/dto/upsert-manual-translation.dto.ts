import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ENTITY_TYPES = [
  'service',
  'service_category',
  'product',
  'product_category',
  'alert',
  'site_settings',
  'offer',
  'loyalty_program',
  'subscription_plan',
  'barber',
  'review_config',
] as const;

export class UpsertManualTranslationDto {
  @IsString()
  @IsIn(ENTITY_TYPES)
  entityType!: (typeof ENTITY_TYPES)[number];

  @IsString()
  entityId!: string;

  @IsString()
  @MaxLength(120)
  fieldKey!: string;

  @IsString()
  @MaxLength(10)
  language!: string;

  @IsString()
  translatedText!: string;

  @IsOptional()
  @IsBoolean()
  manualLocked?: boolean;
}
