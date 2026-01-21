import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class RemoveBrandAdminDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  localId?: string;

  @IsOptional()
  @IsBoolean()
  removeFromAll?: boolean;
}
