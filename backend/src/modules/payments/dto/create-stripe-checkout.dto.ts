import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentProductDto } from '../../appointments/dto/appointment-product.dto';

export class CreateStripeCheckoutDto {
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
