import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateClientNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  content!: string;
}
