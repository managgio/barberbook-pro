import { IsObject } from 'class-validator';

export class UpdateConfigDto {
  @IsObject()
  data!: Record<string, unknown>;
}
