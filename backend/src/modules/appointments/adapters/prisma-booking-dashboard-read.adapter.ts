import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { APP_TIMEZONE, endOfDayInTimeZone, startOfDayInTimeZone } from '../../../utils/timezone';
import { BookingDashboardReadPort } from '../../../contexts/booking/ports/outbound/booking-dashboard-read.port';

@Injectable()
export class PrismaBookingDashboardReadAdapter implements BookingDashboardReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async readDashboardSnapshot(params: {
    localId: string;
    dateFrom: string;
    dateTo: string;
    barberId?: string;
  }) {
    const [barbers, appointments] = await Promise.all([
      this.prisma.barber.findMany({
        where: { localId: params.localId, isArchived: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          localId: params.localId,
          ...(params.barberId ? { barberId: params.barberId } : {}),
          startDateTime: {
            gte: startOfDayInTimeZone(params.dateFrom, APP_TIMEZONE),
            lte: endOfDayInTimeZone(params.dateTo, APP_TIMEZONE),
          },
        },
        orderBy: { startDateTime: 'asc' },
        select: {
          id: true,
          startDateTime: true,
          status: true,
          price: true,
          guestName: true,
          serviceNameSnapshot: true,
          barberNameSnapshot: true,
          user: { select: { name: true } },
          service: { select: { name: true } },
          barber: { select: { name: true } },
        },
      }),
    ]);

    return {
      barbers,
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        startDateTime: appointment.startDateTime,
        status: appointment.status,
        price: appointment.price ? Number(appointment.price) : 0,
        guestName: appointment.guestName,
        serviceNameSnapshot: appointment.serviceNameSnapshot,
        barberNameSnapshot: appointment.barberNameSnapshot,
        userName: appointment.user?.name ?? null,
        serviceName: appointment.service?.name ?? null,
        barberName: appointment.barber?.name ?? null,
      })),
    };
  }
}
