import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestSmsDto {
  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}
