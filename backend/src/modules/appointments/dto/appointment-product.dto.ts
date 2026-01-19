import { IsInt, IsString, Min } from 'class-validator';

export class AppointmentProductDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
