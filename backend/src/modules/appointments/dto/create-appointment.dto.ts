import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus } from '@prisma/client';
import { AppointmentProductDto } from './appointment-product.dto';
import {
  APPOINTMENT_REMINDER_CHANNELS,
  AppointmentReminderChannel,
} from '../../../shared/domain/appointment-reminder-channel';

export class CreateAppointmentDto {
  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsString()
  barberId!: string;

  @IsString()
  serviceId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsString({ each: true })
  serviceIds?: string[];

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
  @IsArray()
  @ArrayMaxSize(APPOINTMENT_REMINDER_CHANNELS.length)
  @ArrayUnique()
  @IsIn(APPOINTMENT_REMINDER_CHANNELS, { each: true })
  reminderChannels?: AppointmentReminderChannel[];

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
