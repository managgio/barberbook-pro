import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';
import { AppointmentProductDto } from './appointment-product.dto';

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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AppointmentProductDto)
  products?: AppointmentProductDto[];
}
