import { IsOptional, IsString } from 'class-validator';

export class ImportProductsDto {
  @IsString()
  sourceLocalId!: string;

  @IsOptional()
  @IsString()
  targetLocalId?: string;
}
