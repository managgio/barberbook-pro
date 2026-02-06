import { IsNotEmptyObject, IsObject } from 'class-validator';

export class UpdateConfigDto {
  @IsObject()
  @IsNotEmptyObject()
  data!: Record<string, unknown>;
}
