import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { BarberRole } from '@prisma/client';

export class CreateBarberDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  photoFileId?: string | null;

  @IsString()
  specialty!: string;

  @IsOptional()
  @IsEnum(BarberRole)
  role?: BarberRole;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  userId?: string;
}
