import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ExtraordinaryOpeningConflictsDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsBoolean()
  allProfessionals!: boolean;

  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  barberIds!: string[];
}
