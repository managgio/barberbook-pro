import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestWhatsappDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}
