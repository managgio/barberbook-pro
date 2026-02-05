import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CashMovementProductOperationType, CashMovementType, PaymentMethod } from '@prisma/client';
import { CashMovementProductItemDto } from './cash-movement-product-item.dto';

export class CreateCashMovementDto {
  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

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

  @IsOptional()
  @IsEnum(CashMovementProductOperationType)
  productOperationType?: CashMovementProductOperationType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CashMovementProductItemDto)
  productItems?: CashMovementProductItemDto[];
}
