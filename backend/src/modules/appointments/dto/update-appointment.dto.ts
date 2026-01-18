import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsOptional()
  @IsString()
  barberId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsDateString()
  startDateTime?: string;

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
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod | null;
}
