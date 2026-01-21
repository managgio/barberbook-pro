import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class AssignBrandAdminDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  localId?: string;

  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @IsOptional()
  @IsString()
  adminRoleId?: string | null;
}
