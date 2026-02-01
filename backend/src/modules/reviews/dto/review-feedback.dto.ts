import { IsString, MaxLength, MinLength } from 'class-validator';
import { ReviewActorDto } from './review-actor.dto';

export class ReviewFeedbackDto extends ReviewActorDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  text!: string;
}
