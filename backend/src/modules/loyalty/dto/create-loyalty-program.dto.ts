import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { LoyaltyScope } from '@prisma/client';

export class CreateLoyaltyProgramDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsEnum(LoyaltyScope)
  scope!: LoyaltyScope;

  @IsInt()
  @Min(1)
  requiredVisits!: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  serviceId?: string | null;

  @IsOptional()
  @IsString()
  categoryId?: string | null;
}
