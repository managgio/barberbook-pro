import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateStripeConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
