import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('availability')
  getAvailability(
    @Query('barberId') barberId: string,
    @Query('date') date: string,
    @Query('serviceId') serviceId?: string,
    @Query('appointmentIdToIgnore') appointmentIdToIgnore?: string,
  ) {
    return this.appointmentsService.getAvailableSlots(barberId, date, { serviceId, appointmentIdToIgnore });
  }

  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('barberId') barberId?: string,
    @Query('date') date?: string,
  ) {
    return this.appointmentsService.findAll({ userId, barberId, date });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateAppointmentDto) {
    return this.appointmentsService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }
}
