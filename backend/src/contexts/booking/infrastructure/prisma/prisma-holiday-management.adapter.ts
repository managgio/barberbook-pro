import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';
import { endOfDayInTimeZone, startOfDayInTimeZone } from '../../../../utils/timezone';

const mapRange = (start: Date, end: Date) => ({
  start: start.toISOString().split('T')[0],
  end: end.toISOString().split('T')[0],
});

@Injectable()
export class PrismaHolidayManagementAdapter implements HolidayManagementPort {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneralHolidays(params: { localId: string }) {
    const holidays = await this.prisma.generalHoliday.findMany({
      where: { localId: params.localId },
      orderBy: { start: 'asc' },
    });
    return holidays.map((holiday) => mapRange(holiday.start, holiday.end));
  }

  async addGeneralHolidayIfMissing(params: { localId: string; start: string; end: string }): Promise<void> {
    const exists = await this.prisma.generalHoliday.findFirst({
      where: {
        localId: params.localId,
        start: new Date(params.start),
        end: new Date(params.end),
      },
    });
    if (exists) return;

    await this.prisma.generalHoliday.create({
      data: {
        localId: params.localId,
        start: new Date(params.start),
        end: new Date(params.end),
      },
    });
  }

  async removeGeneralHoliday(params: { localId: string; start: string; end: string }): Promise<void> {
    await this.prisma.generalHoliday.deleteMany({
      where: {
        localId: params.localId,
        start: new Date(params.start),
        end: new Date(params.end),
      },
    });
  }

  async getBarberHolidays(params: { localId: string; barberId: string }) {
    const holidays = await this.prisma.barberHoliday.findMany({
      where: { localId: params.localId, barberId: params.barberId },
      orderBy: { start: 'asc' },
    });
    return holidays.map((holiday) => mapRange(holiday.start, holiday.end));
  }

  async addBarberHolidayIfMissing(params: {
    localId: string;
    barberId: string;
    start: string;
    end: string;
  }): Promise<void> {
    const exists = await this.prisma.barberHoliday.findFirst({
      where: {
        localId: params.localId,
        barberId: params.barberId,
        start: new Date(params.start),
        end: new Date(params.end),
      },
    });
    if (exists) return;

    await this.prisma.barberHoliday.create({
      data: {
        localId: params.localId,
        barberId: params.barberId,
        start: new Date(params.start),
        end: new Date(params.end),
      },
    });
  }

  async removeBarberHoliday(params: {
    localId: string;
    barberId: string;
    start: string;
    end: string;
  }): Promise<void> {
    await this.prisma.barberHoliday.deleteMany({
      where: {
        localId: params.localId,
        barberId: params.barberId,
        start: new Date(params.start),
        end: new Date(params.end),
      },
    });
  }

  async getAppointmentImpact(params: {
    localId: string;
    timezone: string;
    start: string;
    end: string;
    barberId?: string;
  }) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        localId: params.localId,
        status: 'scheduled',
        barberId: params.barberId,
        startDateTime: {
          gte: startOfDayInTimeZone(params.start, params.timezone),
          lte: endOfDayInTimeZone(params.end, params.timezone),
        },
      },
      select: {
        id: true,
        userId: true,
        guestContact: true,
        user: { select: { email: true } },
      },
    });

    const recipientKeys = new Set<string>();
    let withoutEmail = 0;
    appointments.forEach((appointment) => {
      const guestEmail = appointment.guestContact
        ?.split('·')
        .map((value) => value.trim())
        .find((value) => value.includes('@'));
      const email = appointment.user?.email || guestEmail || null;
      if (!email) withoutEmail += 1;
      recipientKeys.add(
        appointment.userId || email?.toLowerCase() || `appointment:${appointment.id}`,
      );
    });

    return {
      appointmentsAffected: appointments.length,
      clientsAffected: recipientKeys.size,
      withoutEmail,
    };
  }
}
