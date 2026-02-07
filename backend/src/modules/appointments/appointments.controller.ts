import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { AuthService } from '../../auth/auth.service';

@Controller('appointments')
export class AppointmentsController {
  private static readonly MAX_ID_LIST = 80;
  private static readonly MAX_PAGE = 10_000;
  private static readonly MAX_RANGE_DAYS = 62;

  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly authService: AuthService,
  ) {}

  private parseBoundedIds(raw?: string, paramName = 'ids') {
    const values = raw
      ?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (!values || values.length === 0) return undefined;
    if (values.length > AppointmentsController.MAX_ID_LIST) {
      throw new BadRequestException(
        `El parámetro ${paramName} admite un máximo de ${AppointmentsController.MAX_ID_LIST} elementos.`,
      );
    }
    return [...new Set(values)];
  }

  private parseIsoDateOnly(value: string, fieldName: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`Formato inválido en ${fieldName}; usa YYYY-MM-DD.`);
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Fecha inválida en ${fieldName}.`);
    }
    return parsed;
  }

  private assertRangeSize(dateFrom?: string, dateTo?: string, rangeName = 'dateFrom/dateTo') {
    if (!dateFrom || !dateTo) return;
    const from = this.parseIsoDateOnly(dateFrom, 'dateFrom');
    const to = this.parseIsoDateOnly(dateTo, 'dateTo');
    const diffDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (diffDays < 1) {
      throw new BadRequestException(`Rango inválido en ${rangeName}: dateTo debe ser >= dateFrom.`);
    }
    if (diffDays > AppointmentsController.MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Rango demasiado amplio en ${rangeName}: máximo ${AppointmentsController.MAX_RANGE_DAYS} días.`,
      );
    }
  }

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
    const normalizedBarberIds = this.parseBoundedIds(barberIds, 'barberIds');
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
    this.assertRangeSize(dateFrom, dateTo, 'weekly-load');
    const normalizedBarberIds = this.parseBoundedIds(barberIds, 'barberIds');
    return this.appointmentsService.getWeeklyLoad(dateFrom, dateTo, normalizedBarberIds);
  }

  @AdminEndpoint()
  @Get('dashboard-summary')
  getDashboardSummary(
    @Query('window') window?: string,
    @Query('barberId') barberId?: string,
  ) {
    const parsedWindow = window ? Number(window) : undefined;
    const safeWindow = Number.isFinite(parsedWindow)
      ? Math.min(90, Math.max(7, Math.floor(parsedWindow as number)))
      : undefined;
    return this.appointmentsService.getDashboardSummary({
      windowDays: safeWindow,
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
    this.assertRangeSize(dateFrom, dateTo, 'admin-search');
    const filters = { barberId, date, dateFrom, dateTo, sort: normalizedSort };
    const pageNumber = Math.min(
      AppointmentsController.MAX_PAGE,
      Math.max(1, parseInt(page ?? '1', 10) || 1),
    );
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
    this.assertRangeSize(dateFrom, dateTo, 'admin-calendar');
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
    this.assertRangeSize(dateFrom, dateTo, 'appointments');
    const filters = { userId, barberId, date, dateFrom, dateTo, sort: normalizedSort };

    const pageNumber = Math.min(
      AppointmentsController.MAX_PAGE,
      Math.max(1, parseInt(page ?? '1', 10) || 1),
    );
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
