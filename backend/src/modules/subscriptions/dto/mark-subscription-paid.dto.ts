import { PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class MarkSubscriptionPaidDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
