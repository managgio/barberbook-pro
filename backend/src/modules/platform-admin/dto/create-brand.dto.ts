import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  name!: string;

  @IsString()
  subdomain!: string;

  @IsOptional()
  @IsString()
  customDomain?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
