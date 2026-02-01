import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidReferralDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
