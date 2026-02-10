import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BarberRole } from '@prisma/client';

export class UpdateBarberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  photo?: string | null;

  @IsOptional()
  @IsString()
  photoFileId?: string | null;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsEnum(BarberRole)
  role?: BarberRole;

  @IsOptional()
  @IsString()
  bio?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'calendarColor must be a valid hex color' })
  calendarColor?: string;

  @IsOptional()
  @IsString()
  userId?: string | null;
}
