import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const SMTP_HOST_REGEX = /^[a-z0-9.-]+$/i;
const normalizeOptionalLowercase = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
};

export class VerifyBrandEmailConfigDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercase(value))
  @IsEmail()
  @MaxLength(254)
  user?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  password?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercase(value))
  @IsString()
  @MaxLength(253)
  @Matches(SMTP_HOST_REGEX)
  host?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' || value === null ? undefined : Number(value))
  @IsInt()
  @Min(1)
  @Max(65_535)
  port?: number;
}
