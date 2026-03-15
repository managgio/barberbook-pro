import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class QueueRegenerationDto {
  @IsString()
  @IsIn(ENTITY_TYPES)
  entityType!: (typeof ENTITY_TYPES)[number];

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fieldKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  languages?: string[];

  @IsOptional()
  @IsBoolean()
  forceManual?: boolean;
}
