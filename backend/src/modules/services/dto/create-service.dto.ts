import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsNumber()
  @Min(1)
  duration!: number;

  @IsOptional()
  @IsString()
  categoryId?: string | null;
}
