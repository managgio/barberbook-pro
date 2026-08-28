import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { HolidayRangeDto } from './dto/holiday-range.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { HolidayImpactDto } from './dto/holiday-impact.dto';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get('general')
  getGeneral() {
    return this.holidaysService.getGeneralHolidays();
  }

  @Post('impact')
  @AdminEndpoint()
  getImpact(@Body() dto: HolidayImpactDto) {
    return this.holidaysService.getAppointmentImpact(dto);
  }

  @Post('general')
  @AdminEndpoint()
  addGeneral(@Body() range: HolidayRangeDto) {
    return this.holidaysService.addGeneralHoliday(range);
  }

  @Delete('general')
  @AdminEndpoint()
  removeGeneral(@Body() range: HolidayRangeDto) {
    return this.holidaysService.removeGeneralHoliday(range);
  }

  @Get('barbers/:barberId')
  getBarber(@Param('barberId') barberId: string) {
    return this.holidaysService.getBarberHolidays(barberId);
  }

  @Post('barbers/:barberId')
  @AdminEndpoint()
  addBarber(@Param('barberId') barberId: string, @Body() range: HolidayRangeDto) {
    return this.holidaysService.addBarberHoliday(barberId, range);
  }

  @Delete('barbers/:barberId')
  @AdminEndpoint()
  removeBarber(@Param('barberId') barberId: string, @Body() range: HolidayRangeDto) {
    return this.holidaysService.removeBarberHoliday(barberId, range);
  }
}
