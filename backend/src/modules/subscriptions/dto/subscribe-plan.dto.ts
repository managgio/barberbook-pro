import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SubscriptionCheckoutMode {
  stripe = 'stripe',
  next_appointment = 'next_appointment',
}

export class SubscribePlanDto {
  @IsString()
  planId!: string;

  @IsOptional()
  @IsEnum(SubscriptionCheckoutMode)
  paymentMode?: SubscriptionCheckoutMode;
}
