import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListCommunicationsDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsIn(['draft', 'scheduled', 'running', 'completed', 'partial', 'failed', 'cancelled'] as const)
  status?: string;
}
