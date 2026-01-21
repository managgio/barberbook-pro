import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { HolidayRangeDto } from './dto/holiday-range.dto';
import { normalizeRange } from '../schedules/schedule.utils';

const mapRange = (start: Date, end: Date) => ({
  start: start.toISOString().split('T')[0],
  end: end.toISOString().split('T')[0],
});

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneralHolidays() {
    const localId = getCurrentLocalId();
    const holidays = await this.prisma.generalHoliday.findMany({
      where: { localId },
      orderBy: { start: 'asc' },
    });
    return holidays.map((holiday) => mapRange(holiday.start, holiday.end));
  }

  async addGeneralHoliday(range: HolidayRangeDto) {
    const localId = getCurrentLocalId();
    const normalized = normalizeRange(range);
    const exists = await this.prisma.generalHoliday.findFirst({
      where: {
        localId,
        start: new Date(normalized.start),
        end: new Date(normalized.end),
      },
    });
    if (!exists) {
      await this.prisma.generalHoliday.create({
        data: {
          localId,
          start: new Date(normalized.start),
          end: new Date(normalized.end),
        },
      });
    }
    return this.getGeneralHolidays();
  }

  async removeGeneralHoliday(range: HolidayRangeDto) {
    const localId = getCurrentLocalId();
    const normalized = normalizeRange(range);
    await this.prisma.generalHoliday.deleteMany({
      where: {
        localId,
        start: new Date(normalized.start),
        end: new Date(normalized.end),
      },
    });
    return this.getGeneralHolidays();
  }

  async getBarberHolidays(barberId: string) {
    const localId = getCurrentLocalId();
    const holidays = await this.prisma.barberHoliday.findMany({
      where: { barberId, localId },
      orderBy: { start: 'asc' },
    });
    return holidays.map((holiday) => mapRange(holiday.start, holiday.end));
  }

  async addBarberHoliday(barberId: string, range: HolidayRangeDto) {
    const localId = getCurrentLocalId();
    const normalized = normalizeRange(range);
    const exists = await this.prisma.barberHoliday.findFirst({
      where: {
        localId,
        barberId,
        start: new Date(normalized.start),
        end: new Date(normalized.end),
      },
    });
    if (!exists) {
      await this.prisma.barberHoliday.create({
        data: {
          localId,
          barberId,
          start: new Date(normalized.start),
          end: new Date(normalized.end),
        },
      });
    }
    return this.getBarberHolidays(barberId);
  }

  async removeBarberHoliday(barberId: string, range: HolidayRangeDto) {
    const localId = getCurrentLocalId();
    const normalized = normalizeRange(range);
    await this.prisma.barberHoliday.deleteMany({
      where: {
        localId,
        barberId,
        start: new Date(normalized.start),
        end: new Date(normalized.end),
      },
    });
    return this.getBarberHolidays(barberId);
  }
}
