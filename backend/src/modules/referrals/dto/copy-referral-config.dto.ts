import { IsString } from 'class-validator';

export class CopyReferralConfigDto {
  @IsString()
  sourceLocationId!: string;
}
