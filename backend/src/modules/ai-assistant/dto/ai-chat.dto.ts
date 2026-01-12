import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiChatRequestDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
