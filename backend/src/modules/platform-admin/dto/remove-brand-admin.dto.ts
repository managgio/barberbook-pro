import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class RemoveBrandAdminDto {
  @ValidateIf((dto: RemoveBrandAdminDto) => !dto.email)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  userId?: string;

  @ValidateIf((dto: RemoveBrandAdminDto) => !dto.userId)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  localId?: string;

  @IsOptional()
  @IsBoolean()
  removeFromAll?: boolean;
}
