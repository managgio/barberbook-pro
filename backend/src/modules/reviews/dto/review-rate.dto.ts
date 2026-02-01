import { IsInt, Max, Min } from 'class-validator';
import { ReviewActorDto } from './review-actor.dto';

export class ReviewRateDto extends ReviewActorDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
}
