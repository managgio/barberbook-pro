import { IsString } from 'class-validator';

export class ApplyReferralTemplateDto {
  @IsString()
  templateId!: string;
}
