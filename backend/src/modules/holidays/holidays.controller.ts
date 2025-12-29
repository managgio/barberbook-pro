import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { HolidayRangeDto } from './dto/holiday-range.dto';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get('general')
  getGeneral() {
    return this.holidaysService.getGeneralHolidays();
  }

  @Post('general')
  addGeneral(@Body() range: HolidayRangeDto) {
    return this.holidaysService.addGeneralHoliday(range);
  }

  @Delete('general')
  removeGeneral(@Body() range: HolidayRangeDto) {
    return this.holidaysService.removeGeneralHoliday(range);
  }

  @Get('barbers/:barberId')
  getBarber(@Param('barberId') barberId: string) {
    return this.holidaysService.getBarberHolidays(barberId);
  }

  @Post('barbers/:barberId')
  addBarber(@Param('barberId') barberId: string, @Body() range: HolidayRangeDto) {
    return this.holidaysService.addBarberHoliday(barberId, range);
  }

  @Delete('barbers/:barberId')
  removeBarber(@Param('barberId') barberId: string, @Body() range: HolidayRangeDto) {
    return this.holidaysService.removeBarberHoliday(barberId, range);
  }
}
