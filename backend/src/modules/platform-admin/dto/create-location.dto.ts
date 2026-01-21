import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
