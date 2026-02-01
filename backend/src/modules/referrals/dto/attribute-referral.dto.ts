import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReferralChannel {
  whatsapp = 'whatsapp',
  qr = 'qr',
  copy = 'copy',
  link = 'link',
}

export class AttributeReferralDto {
  @IsString()
  code!: string;

  @IsEnum(ReferralChannel)
  channel!: ReferralChannel;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  referredPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  referredEmail?: string;
}
