import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { FAQ_LIMITS } from '../../../contexts/engagement/domain/services/faq-policy';

export class CreateFaqDto {
  @IsString()
  @MinLength(1)
  @MaxLength(FAQ_LIMITS.question)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(FAQ_LIMITS.answer)
  answer!: string;
}

export class FaqVersionDto {
  @IsInt()
  @Min(1)
  version!: number;
}

export class UpdateFaqDto extends CreateFaqDto {
  @IsInt()
  @Min(1)
  version!: number;
}

export class ReorderFaqsDto {
  @IsArray()
  @ArrayMaxSize(FAQ_LIMITS.items)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(191, { each: true })
  expectedIds!: string[];

  @IsArray()
  @ArrayMaxSize(FAQ_LIMITS.items)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(191, { each: true })
  orderedIds!: string[];
}
