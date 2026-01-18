import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CashMovementType, PaymentMethod } from '@prisma/client';

export class UpdateCashMovementDto {
  @IsOptional()
  @IsEnum(CashMovementType)
  type?: CashMovementType;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod | null;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
