import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { APP_TIMEZONE, endOfDayInTimeZone, startOfDayInTimeZone } from '../../../../utils/timezone';
import {
  BookingAppointmentSlotRecord,
  BookingAvailabilityReadPort,
} from '../../ports/outbound/booking-availability-read.port';

@Injectable()
export class PrismaBookingAvailabilityReadAdapter implements BookingAvailabilityReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listAppointmentsForBarberDay(params: {
    localId: string;
    barberId: string;
    dateOnly: string;
    appointmentIdToIgnore?: string;
  }): Promise<BookingAppointmentSlotRecord[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        localId: params.localId,
        barberId: params.barberId,
        status: { not: 'cancelled' },
        startDateTime: {
          gte: startOfDayInTimeZone(params.dateOnly, APP_TIMEZONE),
          lte: endOfDayInTimeZone(params.dateOnly, APP_TIMEZONE),
        },
        NOT: params.appointmentIdToIgnore ? { id: params.appointmentIdToIgnore } : undefined,
      },
      include: { service: { select: { duration: true } } },
    });

    return appointments.map((appointment) => ({
      barberId: appointment.barberId,
      startDateTime: appointment.startDateTime,
      serviceDurationMinutes: appointment.service?.duration,
    }));
  }

  async listAppointmentsForBarbersDay(params: {
    localId: string;
    barberIds: string[];
    dateOnly: string;
    appointmentIdToIgnore?: string;
  }): Promise<BookingAppointmentSlotRecord[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        localId: params.localId,
        barberId: { in: params.barberIds },
        status: { not: 'cancelled' },
        startDateTime: {
          gte: startOfDayInTimeZone(params.dateOnly, APP_TIMEZONE),
          lte: endOfDayInTimeZone(params.dateOnly, APP_TIMEZONE),
        },
        NOT: params.appointmentIdToIgnore ? { id: params.appointmentIdToIgnore } : undefined,
      },
      include: { service: { select: { duration: true } } },
    });

    return appointments.map((appointment) => ({
      barberId: appointment.barberId,
      startDateTime: appointment.startDateTime,
      serviceDurationMinutes: appointment.service?.duration,
    }));
  }

  async countWeeklyLoad(params: {
    localId: string;
    dateFrom: string;
    dateTo: string;
    barberIds?: string[];
  }): Promise<Record<string, number>> {
    const normalizedBarberIds = Array.from(new Set((params.barberIds || []).filter(Boolean)));

    const grouped = await this.prisma.appointment.groupBy({
      by: ['barberId'],
      where: {
        localId: params.localId,
        status: { not: 'cancelled' },
        startDateTime: {
          gte: startOfDayInTimeZone(params.dateFrom, APP_TIMEZONE),
          lte: endOfDayInTimeZone(params.dateTo, APP_TIMEZONE),
        },
        ...(normalizedBarberIds.length > 0 ? { barberId: { in: normalizedBarberIds } } : {}),
      },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    grouped.forEach((item) => {
      counts[item.barberId] = item._count._all;
    });

    return counts;
  }
}
