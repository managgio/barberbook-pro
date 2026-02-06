import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { AuthService } from '../../auth/auth.service';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly authService: AuthService,
  ) {}

  @Get('availability')
  getAvailability(
    @Query('barberId') barberId: string,
    @Query('date') date: string,
    @Query('serviceId') serviceId?: string,
    @Query('appointmentIdToIgnore') appointmentIdToIgnore?: string,
  ) {
    return this.appointmentsService.getAvailableSlots(barberId, date, { serviceId, appointmentIdToIgnore });
  }

  @Get('availability-batch')
  getAvailabilityBatch(
    @Query('date') date?: string,
    @Query('barberIds') barberIds?: string,
    @Query('serviceId') serviceId?: string,
    @Query('appointmentIdToIgnore') appointmentIdToIgnore?: string,
  ) {
    const normalizedBarberIds = barberIds
      ?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    return this.appointmentsService.getAvailableSlotsBatch(date, normalizedBarberIds, {
      serviceId,
      appointmentIdToIgnore,
    });
  }

  @Get('weekly-load')
  getWeeklyLoad(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('barberIds') barberIds?: string,
  ) {
    const normalizedBarberIds = barberIds
      ?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    return this.appointmentsService.getWeeklyLoad(dateFrom, dateTo, normalizedBarberIds);
  }

  @AdminEndpoint()
  @Get('dashboard-summary')
  getDashboardSummary(
    @Query('window') window?: string,
    @Query('barberId') barberId?: string,
  ) {
    const parsedWindow = window ? Number(window) : undefined;
    return this.appointmentsService.getDashboardSummary({
      windowDays: Number.isFinite(parsedWindow) ? parsedWindow : undefined,
      barberId: barberId && barberId !== 'all' ? barberId : undefined,
    });
  }

  @AdminEndpoint()
  @Get('admin-search')
  findAdminSearch(
    @Query('barberId') barberId?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const normalizedSort: 'asc' | 'desc' = sort === 'desc' ? 'desc' : 'asc';
    const filters = { barberId, date, dateFrom, dateTo, sort: normalizedSort };
    const pageNumber = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(pageSize ?? '50', 10) || 50));
    return this.appointmentsService.findPageWithClients({
      ...filters,
      page: pageNumber,
      pageSize: limit,
    });
  }

  @AdminEndpoint()
  @Get('admin-calendar')
  findAdminCalendar(
    @Query('barberId') barberId?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
  ) {
    if (!date && !(dateFrom && dateTo)) {
      throw new BadRequestException('Debes enviar date o dateFrom+dateTo.');
    }
    const normalizedSort: 'asc' | 'desc' = sort === 'desc' ? 'desc' : 'asc';
    return this.appointmentsService.findRangeWithClients({
      barberId,
      date,
      dateFrom,
      dateTo,
      sort: normalizedSort,
    });
  }

  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('barberId') barberId?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const normalizedSort: 'asc' | 'desc' = sort === 'desc' ? 'desc' : 'asc';
    const filters = { userId, barberId, date, dateFrom, dateTo, sort: normalizedSort };

    const pageNumber = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(pageSize ?? '50', 10) || 50));
    return this.appointmentsService.findPage({ ...filters, page: pageNumber, pageSize: limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Post()
  async create(@Body() data: CreateAppointmentDto, @Req() req: any) {
    const adminUserId = await this.resolveAdminUserId(req);
    const ip = this.resolveRequestIp(req);
    const userAgent = typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null;
    return this.appointmentsService.create(data, {
      requireConsent: !adminUserId,
      ip,
      userAgent,
      actorUserId: adminUserId,
    });
  }

  @AdminEndpoint()
  @Post(':id/anonymize')
  anonymize(@Param('id') id: string, @Req() req: { adminUserId?: string }) {
    return this.appointmentsService.anonymizeAppointment(id, req.adminUserId || null);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: UpdateAppointmentDto, @Req() req: any) {
    const adminUserId = await this.resolveAdminUserId(req);
    return this.appointmentsService.update(id, data, { actorUserId: adminUserId });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }

  private async resolveAdminUserId(req: any): Promise<string | null> {
    const user = await this.authService.resolveUserFromRequest(req);
    if (!user) return null;
    if (user.isSuperAdmin || user.isPlatformAdmin || user.role === 'admin') {
      return user.id;
    }
    return null;
  }

  private resolveRequestIp(req: any): string | null {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
  }
}
