import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
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
  guestName?: string;

  @IsOptional()
  @IsString()
  guestContact?: string;

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
