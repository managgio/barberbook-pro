import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateInvoiceLegalSettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  legalOwnerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  legalOwnerTaxId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalOwnerAddress!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  legalContactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  legalContactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}
