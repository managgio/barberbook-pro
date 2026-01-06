import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { mapAppointment } from './appointments.mapper';
import { generateSlotsForShift, isDateInRange, normalizeRange, timeToMinutes } from '../schedules/schedule.utils';
import { HolidaysService } from '../holidays/holidays.service';
import { SchedulesService } from '../schedules/schedules.service';
import { DEFAULT_SHOP_SCHEDULE, ShopSchedule } from '../schedules/schedule.types';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_SERVICE_DURATION = 30;
const SLOT_INTERVAL_MINUTES = 15;

const startOfDay = (date: string) => new Date(`${date}T00:00:00`);
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`);

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    private readonly schedulesService: SchedulesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async getServiceDuration(serviceId?: string) {
    if (!serviceId) return DEFAULT_SERVICE_DURATION;
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    return service?.duration ?? DEFAULT_SERVICE_DURATION;
  }

  async findAll(filters?: { userId?: string; barberId?: string; date?: string }) {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.barberId) where.barberId = filters.barberId;
    if (filters?.date) {
      where.startDateTime = {
        gte: startOfDay(filters.date),
        lte: endOfDay(filters.date),
      };
    }
    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startDateTime: 'asc' },
    });
    return appointments.map(mapAppointment);
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return mapAppointment(appointment);
  }

  async create(data: CreateAppointmentDto) {
    const appointment = await this.prisma.appointment.create({
      data: {
        userId: data.userId,
        barberId: data.barberId,
        serviceId: data.serviceId,
        startDateTime: new Date(data.startDateTime),
        status: data.status || 'confirmed',
        notes: data.notes,
        guestName: data.guestName,
        guestContact: data.guestContact,
        reminderSent: false,
      },
      include: { user: true, barber: true, service: true },
    });

    await this.notifyAppointment(appointment, 'creada');
    return mapAppointment(appointment);
  }

  async update(id: string, data: UpdateAppointmentDto) {
    try {
      const current = await this.prisma.appointment.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Appointment not found');

      const startChanged = data.startDateTime && new Date(data.startDateTime).getTime() !== current.startDateTime.getTime();
      const statusChanged = data.status && data.status !== current.status;
      const newStatus = data.status || current.status;
      const isCancelled = statusChanged && data.status === 'cancelled';

      let reminderSent: boolean | undefined;
      if (statusChanged) {
        reminderSent = data.status === 'cancelled' ? true : false;
      } else if (startChanged) {
        reminderSent = false;
      }

      const updated = await this.prisma.appointment.update({
        where: { id },
        data: {
          userId: data.userId,
          barberId: data.barberId,
          serviceId: data.serviceId,
          startDateTime: data.startDateTime ? new Date(data.startDateTime) : undefined,
          status: data.status,
          notes: data.notes,
          guestName: data.guestName,
          guestContact: data.guestContact,
          reminderSent,
        },
        include: { user: true, barber: true, service: true },
      });

      await this.notifyAppointment(updated, isCancelled ? 'cancelada' : 'actualizada');
      return mapAppointment(updated);
    } catch (error) {
      throw new NotFoundException('Appointment not found');
    }
  }

  async remove(id: string) {
    await this.prisma.appointment.delete({ where: { id } });
    return { success: true };
  }

  async getAvailableSlots(
    barberId: string,
    date: string,
    options?: { serviceId?: string; appointmentIdToIgnore?: string },
  ): Promise<string[]> {
    const barber = await this.prisma.barber.findUnique({ where: { id: barberId } });
    const dateOnly = date.split('T')[0];
    if (!barber || barber.isActive === false) return [];

    const startDate = barber.startDate ? barber.startDate.toISOString().split('T')[0] : null;
    const endDate = barber.endDate ? barber.endDate.toISOString().split('T')[0] : null;
    if (startDate && dateOnly < startDate) return [];
    if (endDate && dateOnly > endDate) return [];

    const schedule = await this.schedulesService.getBarberSchedule(barberId);
    const dayKey = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof ShopSchedule;
    const daySchedule = (schedule || DEFAULT_SHOP_SCHEDULE)[dayKey];
    if (!daySchedule || daySchedule.closed) return [];

    const generalHolidays = await this.holidaysService.getGeneralHolidays();
    if (generalHolidays.some((range) => isDateInRange(dateOnly, normalizeRange(range)))) return [];
    const barberHolidays = await this.holidaysService.getBarberHolidays(barberId);
    if (barberHolidays.some((range) => isDateInRange(dateOnly, normalizeRange(range)))) return [];

    const targetDuration = await this.getServiceDuration(options?.serviceId);
    const rawSlots = [
      ...generateSlotsForShift(daySchedule.morning, targetDuration, SLOT_INTERVAL_MINUTES),
      ...generateSlotsForShift(daySchedule.afternoon, targetDuration, SLOT_INTERVAL_MINUTES),
    ];
    if (rawSlots.length === 0) return [];
    const uniqueSlots = Array.from(new Set(rawSlots));

    const appointments = await this.prisma.appointment.findMany({
      where: {
        barberId,
        status: { not: 'cancelled' },
        startDateTime: { gte: startOfDay(dateOnly), lte: endOfDay(dateOnly) },
        NOT: options?.appointmentIdToIgnore ? { id: options.appointmentIdToIgnore } : undefined,
      },
      include: { service: true },
    });

    const bookedRanges = appointments.map((appointment) => {
      const start = appointment.startDateTime;
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const duration = appointment.service?.duration ?? DEFAULT_SERVICE_DURATION;
      return { start: startMinutes, end: startMinutes + duration };
    });

    return uniqueSlots.filter((slot) => {
      const slotStart = timeToMinutes(slot);
      const slotEnd = slotStart + targetDuration;
      return bookedRanges.every((range) => slotEnd <= range.start || slotStart >= range.end);
    });
  }

  private async notifyAppointment(appointment: any, action: 'creada' | 'actualizada' | 'cancelada') {
    const contact = this.getContact(appointment.user, appointment.guestName, appointment.guestContact);
    const allowEmail = appointment.user ? appointment.user.notificationEmail !== false : true;
    if (allowEmail) {
      await this.notificationsService.sendAppointmentEmail(
        contact,
        {
          date: appointment.startDateTime,
          serviceName: appointment.service?.name,
          barberName: appointment.barber?.name,
        },
        action,
      );
    }
  }

  private getContact(user: any, guestName?: string | null, guestContact?: string | null) {
    const emailCandidate = user?.email || (guestContact?.includes('@') ? guestContact : null);
    const phoneCandidate = user?.phone || (!guestContact?.includes('@') ? guestContact : null);
    return {
      email: emailCandidate || null,
      phone: phoneCandidate || null,
      name: user?.name || guestName || null,
    };
  }
}
