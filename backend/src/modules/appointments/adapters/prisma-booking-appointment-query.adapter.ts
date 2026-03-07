import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BookingAppointmentClient,
  BookingAppointmentListFilters,
  BookingAppointmentQueryPort,
} from '../../../contexts/booking/ports/outbound/booking-appointment-query.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { APP_TIMEZONE, endOfDayInTimeZone, startOfDayInTimeZone } from '../../../utils/timezone';
import { mapAppointment } from '../appointments.mapper';

@Injectable()
export class PrismaBookingAppointmentQueryAdapter implements BookingAppointmentQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAppointmentsPage(params: {
    localId: string;
    filters: BookingAppointmentListFilters;
    page: number;
    pageSize: number;
  }) {
    const where = this.buildListWhere(params.localId, params.filters);
    const [total, appointments] = await this.prisma.$transaction([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        orderBy: this.buildListOrder(params.filters),
        include: {
          barber: { select: { name: true } },
          service: true,
          products: { include: { product: true } },
        },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
      items: appointments.map(mapAppointment),
    };
  }

  async findAppointmentsPageWithClients(params: {
    localId: string;
    filters: BookingAppointmentListFilters;
    page: number;
    pageSize: number;
  }) {
    const where = this.buildListWhere(params.localId, params.filters);
    const [total, appointments] = await this.prisma.$transaction([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        orderBy: this.buildListOrder(params.filters),
        include: {
          barber: { select: { name: true } },
          service: true,
          products: { include: { product: true } },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    const clients = this.collectClients(appointments);
    return {
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
      items: appointments.map(mapAppointment),
      clients,
    };
  }

  async findAppointmentsRangeWithClients(params: {
    localId: string;
    filters: BookingAppointmentListFilters;
  }) {
    const where = this.buildListWhere(params.localId, params.filters);
    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: this.buildListOrder(params.filters),
      include: {
        barber: { select: { name: true } },
        service: true,
        products: { include: { product: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const clients = this.collectClients(appointments);
    return {
      items: appointments.map(mapAppointment),
      clients,
    };
  }

  async findAppointmentById(params: { localId: string; appointmentId: string }) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: params.appointmentId, localId: params.localId },
      include: {
        barber: { select: { name: true } },
        service: true,
        products: { include: { product: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return mapAppointment(appointment);
  }

  private collectClients(
    appointments: Array<{
      user?: { id: string; name: string; email: string; phone: string | null } | null;
    }>,
  ): BookingAppointmentClient[] {
    const clientMap = new Map<string, BookingAppointmentClient>();
    appointments.forEach((appointment) => {
      const user = appointment.user;
      if (!user) return;
      clientMap.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
    });
    return Array.from(clientMap.values());
  }

  private buildListWhere(localId: string, filters?: BookingAppointmentListFilters): Prisma.AppointmentWhereInput {
    const where: Prisma.AppointmentWhereInput = { localId };
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.barberId) where.barberId = filters.barberId;
    if (filters?.date) {
      where.startDateTime = {
        gte: startOfDayInTimeZone(filters.date, APP_TIMEZONE),
        lte: endOfDayInTimeZone(filters.date, APP_TIMEZONE),
      };
    } else if (filters?.dateFrom || filters?.dateTo) {
      where.startDateTime = {
        ...(filters.dateFrom ? { gte: startOfDayInTimeZone(filters.dateFrom, APP_TIMEZONE) } : {}),
        ...(filters.dateTo ? { lte: endOfDayInTimeZone(filters.dateTo, APP_TIMEZONE) } : {}),
      };
    }
    return where;
  }

  private buildListOrder(filters?: BookingAppointmentListFilters): Prisma.AppointmentOrderByWithRelationInput {
    return { startDateTime: filters?.sort === 'desc' ? 'desc' : 'asc' };
  }
}
