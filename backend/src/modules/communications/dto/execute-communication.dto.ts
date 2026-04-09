import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ExecuteCommunicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
