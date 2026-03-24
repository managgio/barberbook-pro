import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AppointmentsFacade } from './appointments.facade';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';

type RequestActor = {
  userId: string | null;
  adminUserId: string | null;
  isAdmin: boolean;
};

@Controller('appointments')
export class AppointmentsController {
  private static readonly MAX_ID_LIST = 80;
  private static readonly MAX_PAGE = 10_000;
  private static readonly MAX_RANGE_DAYS = 62;

  constructor(
    private readonly appointmentsFacade: AppointmentsFacade,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
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
    return this.appointmentsFacade.getAvailability(barberId, date, serviceId, appointmentIdToIgnore);
  }

  @Get('availability-batch')
  getAvailabilityBatch(
    @Query('date') date?: string,
    @Query('barberIds') barberIds?: string,
    @Query('serviceId') serviceId?: string,
    @Query('appointmentIdToIgnore') appointmentIdToIgnore?: string,
  ) {
    const normalizedBarberIds = this.parseBoundedIds(barberIds, 'barberIds');
    return this.appointmentsFacade.getAvailabilityBatch(date, normalizedBarberIds, {
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
    return this.appointmentsFacade.getWeeklyLoad(dateFrom, dateTo, normalizedBarberIds);
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
    return this.appointmentsFacade.getDashboardSummary({
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
    return this.appointmentsFacade.findPageWithClients({
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
    return this.appointmentsFacade.findRangeWithClients({
      barberId,
      date,
      dateFrom,
      dateTo,
      sort: normalizedSort,
    });
  }

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('barberId') barberId?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const actor = await this.resolveRequestActor(req);
    const normalizedSort: 'asc' | 'desc' = sort === 'desc' ? 'desc' : 'asc';
    this.assertRangeSize(dateFrom, dateTo, 'appointments');
    let effectiveUserId = userId;
    if (!actor.isAdmin) {
      if (!actor.userId) {
        throw new UnauthorizedException('Se requiere autenticación.');
      }
      if (userId && userId !== actor.userId) {
        throw new ForbiddenException('Solo puedes consultar tus propias citas.');
      }
      effectiveUserId = actor.userId;
    }
    const filters = {
      userId: effectiveUserId,
      barberId,
      date,
      dateFrom,
      dateTo,
      sort: normalizedSort,
    };

    const pageNumber = Math.min(
      AppointmentsController.MAX_PAGE,
      Math.max(1, parseInt(page ?? '1', 10) || 1),
    );
    const limit = Math.min(200, Math.max(10, parseInt(pageSize ?? '50', 10) || 50));
    return this.appointmentsFacade.findPage({ ...filters, page: pageNumber, pageSize: limit });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const actor = await this.resolveRequestActor(req);
    if (!actor.isAdmin && !actor.userId) {
      throw new UnauthorizedException('Se requiere autenticación.');
    }
    const appointment = await this.appointmentsFacade.findOne(id) as { userId: string | null };
    if (!actor.isAdmin) {
      if (appointment.userId !== actor.userId) {
        throw new ForbiddenException('No puedes consultar esta cita.');
      }
    }
    return appointment;
  }

  @Post()
  async create(@Body() data: CreateAppointmentDto, @Req() req: any) {
    const actor = await this.resolveRequestActor(req);
    const payload: CreateAppointmentDto = { ...data };
    if (!actor.isAdmin) {
      if (payload.status && payload.status !== 'scheduled') {
        throw new ForbiddenException('Solo administradores pueden crear citas con estado personalizado.');
      }
      if (actor.userId) {
        if (payload.userId && payload.userId !== actor.userId) {
          throw new ForbiddenException('No puedes crear citas para otro cliente.');
        }
        payload.userId = actor.userId;
      } else if (payload.userId) {
        throw new BadRequestException('No puedes asignar userId en una reserva como invitado.');
      }
    }

    const ip = this.resolveRequestIp(req);
    const userAgent = typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null;
    return this.appointmentsFacade.create(payload, {
      requireConsent: !actor.isAdmin,
      ip,
      userAgent,
      actorUserId: actor.adminUserId,
    });
  }

  @AdminEndpoint()
  @Post(':id/anonymize')
  anonymize(@Param('id') id: string, @Req() req: { adminUserId?: string }) {
    return this.appointmentsFacade.anonymize(id, req.adminUserId || null);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: UpdateAppointmentDto, @Req() req: any) {
    const actor = await this.resolveRequestActor(req);
    if (!actor.isAdmin) {
      if (!actor.userId) {
        throw new UnauthorizedException('Se requiere autenticación.');
      }
      await this.ensureAppointmentOwnership(id, actor.userId);
      this.assertClientUpdateAllowed(data);
    }
    return this.appointmentsFacade.update(id, { ...data, userId: undefined }, { actorUserId: actor.adminUserId });
  }

  @AdminEndpoint()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentsFacade.remove(id);
  }

  private async resolveRequestActor(req: any): Promise<RequestActor> {
    const user = await this.authService.resolveUserFromRequest(req);
    if (!user) {
      return { userId: null, adminUserId: null, isAdmin: false };
    }

    if (user.isSuperAdmin || user.isPlatformAdmin) {
      return { userId: user.id, adminUserId: user.id, isAdmin: true };
    }

    if (user.role === 'admin') {
      const localId = this.tenantContextPort.getRequestContext().localId;
      const membership = await this.prisma.locationStaff.findUnique({
        where: {
          localId_userId: {
            localId,
            userId: user.id,
          },
        },
        select: { userId: true },
      });
      if (membership) {
        return { userId: user.id, adminUserId: user.id, isAdmin: true };
      }
    }

    return { userId: user.id, adminUserId: null, isAdmin: false };
  }

  private async ensureAppointmentOwnership(appointmentId: string, userId: string) {
    const appointment = await this.appointmentsFacade.findOne(appointmentId) as { userId: string | null };
    if (appointment.userId !== userId) {
      throw new ForbiddenException('No puedes modificar una cita de otro cliente.');
    }
  }

  private assertClientUpdateAllowed(data: UpdateAppointmentDto) {
    if (data.status && data.status !== 'cancelled') {
      throw new ForbiddenException('Solo puedes cancelar tus citas.');
    }
    if (data.userId !== undefined && data.userId !== null) {
      throw new ForbiddenException('No puedes reasignar el cliente de una cita.');
    }
  }

  private resolveRequestIp(req: any): string | null {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
  }
}
