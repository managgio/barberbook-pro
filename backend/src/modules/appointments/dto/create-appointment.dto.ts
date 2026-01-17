import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class CreateAppointmentDto {
  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsString()
  barberId!: string;

  @IsString()
  serviceId!: string;

  @IsDateString()
  startDateTime!: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  notes?: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  guestContact?: string;

  @IsOptional()
  @IsBoolean()
  privacyConsentGiven?: boolean;
}
