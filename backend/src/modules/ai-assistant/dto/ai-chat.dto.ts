import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiChatRequestDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsIn(['typed', 'voice', 'template'])
  inputSource?: 'typed' | 'voice' | 'template';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateKey?: string;
}
