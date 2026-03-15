import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PauseTenantI18nDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

