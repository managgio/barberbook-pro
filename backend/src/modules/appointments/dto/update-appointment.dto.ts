import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
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
  @MaxLength(191)
  guestName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  guestContact?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  guestEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guestPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod | null;

  @IsOptional()
  @IsString()
  referralAttributionId?: string | null;

  @IsOptional()
  @IsString()
  appliedCouponId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  walletAppliedAmount?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AppointmentProductDto)
  products?: AppointmentProductDto[];
}
