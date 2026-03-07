import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';

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
}

