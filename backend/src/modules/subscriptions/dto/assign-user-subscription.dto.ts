import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignUserSubscriptionDto {
  @IsString()
  planId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;
}
