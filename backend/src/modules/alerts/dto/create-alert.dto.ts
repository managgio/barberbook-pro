import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AlertType } from '@prisma/client';

export class CreateAlertDto {
  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;
}
