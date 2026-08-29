import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus } from '@prisma/client';
import { AppointmentProductDto } from './appointment-product.dto';

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
  @IsBoolean()
  notifyIfEarlierSlot?: boolean;

  @IsOptional()
  @IsBoolean()
  privacyConsentGiven?: boolean;

  @IsOptional()
  @IsString()
  referralAttributionId?: string;

  @IsOptional()
  @IsString()
  appliedCouponId?: string;

  @IsOptional()
  @IsBoolean()
  useWallet?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AppointmentProductDto)
  products?: AppointmentProductDto[];
}
