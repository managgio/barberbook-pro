import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateBarberServiceAssignmentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}
