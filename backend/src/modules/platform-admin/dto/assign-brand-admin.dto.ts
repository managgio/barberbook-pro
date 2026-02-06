import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AssignBrandAdminDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  localId?: string;

  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  })
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  adminRoleId?: string | null;
}
