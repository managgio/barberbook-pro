import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubProcessorDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(200)
  purpose!: string;

  @IsString()
  @MaxLength(80)
  country!: string;

  @IsString()
  @MaxLength(200)
  dataTypes!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  link?: string | null;
}

export class LegalSectionDto {
  @IsString()
  @MaxLength(160)
  heading!: string;

  @IsString()
  @MaxLength(4000)
  bodyMarkdown!: string;
}

export class LegalCustomSectionsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalSectionDto)
  privacy?: LegalSectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalSectionDto)
  cookies?: LegalSectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalSectionDto)
  notice?: LegalSectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalSectionDto)
  dpa?: LegalSectionDto[];
}

export class UpdateLegalSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalOwnerName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  legalOwnerTaxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalOwnerAddress?: string | null;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  privacyPolicyVersion?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cookiePolicyVersion?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  legalNoticeVersion?: number;

  @IsOptional()
  @IsBoolean()
  aiDisclosureEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aiProviderNames?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubProcessorDto)
  subProcessors?: SubProcessorDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LegalCustomSectionsDto)
  optionalCustomSections?: LegalCustomSectionsDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number | null;
}
