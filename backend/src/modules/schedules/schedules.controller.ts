import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('shop')
  getShopSchedule() {
    return this.schedulesService.getShopSchedule();
  }

  @Put('shop')
  @AdminEndpoint()
  updateShopSchedule(@Body() body: UpsertScheduleDto) {
    return this.schedulesService.updateShopSchedule(body.schedule);
  }

  @Get('barbers/:barberId')
  getBarberSchedule(@Param('barberId') barberId: string) {
    return this.schedulesService.getBarberSchedule(barberId);
  }

  @Put('barbers/:barberId')
  @AdminEndpoint()
  updateBarberSchedule(@Param('barberId') barberId: string, @Body() body: UpsertScheduleDto) {
    return this.schedulesService.updateBarberSchedule(barberId, body.schedule);
  }
}
