import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateLocationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toLowerCase();
    return normalized.length === 0 ? null : normalized;
  })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(SLUG_REGEX)
  slug?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
