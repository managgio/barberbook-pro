import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { UpdateExtraordinaryOpeningsDto } from './dto/update-extraordinary-openings.dto';
import { ExtraordinaryOpeningConflictsDto } from './dto/extraordinary-opening-conflicts.dto';

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

  @Put('shop/extraordinary-openings')
  @AdminEndpoint()
  updateExtraordinaryOpenings(@Body() body: UpdateExtraordinaryOpeningsDto) {
    return this.schedulesService.updateExtraordinaryOpenings(body.extraordinaryOpenings);
  }

  @Post('shop/extraordinary-openings/conflicts')
  @AdminEndpoint()
  getExtraordinaryOpeningConflicts(@Body() body: ExtraordinaryOpeningConflictsDto) {
    return this.schedulesService.getExtraordinaryOpeningConflicts(body);
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
