import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AlertType } from '@prisma/client';

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;
}
