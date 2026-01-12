import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  firebaseUid?: string;

  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  notificationEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  prefersBarberSelection?: boolean;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  adminRoleId?: string | null;

  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;
}
