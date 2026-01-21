import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClientNoteDto {
  @IsString()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  content!: string;
}
