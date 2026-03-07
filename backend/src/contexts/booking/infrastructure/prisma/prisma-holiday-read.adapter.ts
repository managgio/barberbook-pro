import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { HolidayReadPort } from '../../ports/outbound/holiday-read.port';

const mapRange = (start: Date, end: Date) => ({
  start: start.toISOString().split('T')[0],
  end: end.toISOString().split('T')[0],
});

@Injectable()
export class PrismaHolidayReadAdapter implements HolidayReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneralHolidays(params: { localId: string }) {
    const holidays = await this.prisma.generalHoliday.findMany({
      where: { localId: params.localId },
      orderBy: { start: 'asc' },
    });
    return holidays.map((holiday) => mapRange(holiday.start, holiday.end));
  }

  async getBarberHolidays(params: { localId: string; barberId: string }) {
    const holidays = await this.prisma.barberHoliday.findMany({
      where: { localId: params.localId, barberId: params.barberId },
      orderBy: { start: 'asc' },
    });
    return holidays.map((holiday) => mapRange(holiday.start, holiday.end));
  }

  async getBarberHolidaysByBarberIds(params: { localId: string; barberIds: string[] }) {
    const rows = await this.prisma.barberHoliday.findMany({
      where: {
        localId: params.localId,
        barberId: { in: params.barberIds },
      },
      select: {
        barberId: true,
        start: true,
        end: true,
      },
    });

    const byBarberId: Record<string, Array<{ start: string; end: string }>> = {};
    params.barberIds.forEach((barberId) => {
      byBarberId[barberId] = [];
    });

    rows.forEach((row) => {
      byBarberId[row.barberId] ||= [];
      byBarberId[row.barberId].push({
        start: row.start.toISOString().split('T')[0],
        end: row.end.toISOString().split('T')[0],
      });
    });

    return byBarberId;
  }
}
