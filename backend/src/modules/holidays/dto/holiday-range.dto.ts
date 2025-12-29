import { IsDateString, IsNotEmpty } from 'class-validator';

export class HolidayRangeDto {
  @IsDateString()
  @IsNotEmpty()
  start!: string;

  @IsDateString()
  @IsNotEmpty()
  end!: string;
}
