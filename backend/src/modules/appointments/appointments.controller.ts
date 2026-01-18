import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly prisma: PrismaService,
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
    const adminUserId = req.headers?.['x-admin-user-id'];
    if (!adminUserId || typeof adminUserId !== 'string') return null;
    const user = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true, isSuperAdmin: true, isPlatformAdmin: true },
    });
    if (!user) return null;
    if (user.isSuperAdmin || user.isPlatformAdmin || user.role === 'admin') {
      return adminUserId;
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
