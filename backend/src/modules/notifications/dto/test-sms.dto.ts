import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestSmsDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}
