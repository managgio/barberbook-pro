import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CommunicationPayloadDto } from './communication-payload.dto';

export class CreateCommunicationDto extends CommunicationPayloadDto {
  @IsOptional()
  @IsBoolean()
  saveAsDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  executeNow?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
