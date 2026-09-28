import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { endOfDayInTimeZone, startOfDayInTimeZone } from '../../../../utils/timezone';
import { normalizeExtraordinaryOpenings } from '../../domain/value-objects/extraordinary-opening';
import {
  BookingSchedulePolicy,
  ExtraordinaryOpeningsByDate,
} from '../../domain/value-objects/schedule';
import {
  ExtraordinaryOpeningConflictSummary,
  ExtraordinaryOpeningManagementPort,
} from '../../ports/outbound/extraordinary-opening-management.port';
import {
  cloneSchedule,
  DEFAULT_SHOP_SCHEDULE,
  normalizeSchedule,
} from './support/schedule.policy';

@Injectable()
export class PrismaExtraordinaryOpeningManagementAdapter
  implements ExtraordinaryOpeningManagementPort {
  constructor(private readonly prisma: PrismaService) {}

  async updateOpenings(params: {
    localId: string;
    openings: ExtraordinaryOpeningsByDate;
  }): Promise<BookingSchedulePolicy> {
    const normalizedOpenings = normalizeExtraordinaryOpenings(params.openings);
    const requestedBarberIds = Array.from(new Set(
      Object.values(normalizedOpenings).flatMap((opening) => opening.barberIds),
    ));
    const scopedBarbers = requestedBarberIds.length > 0
      ? await this.prisma.barber.findMany({
        where: {
          localId: params.localId,
          id: { in: requestedBarberIds },
          isArchived: false,
        },
        select: { id: true },
      })
      : [];
    const scopedBarberIds = new Set(scopedBarbers.map((barber) => barber.id));

    const scopedOpenings = Object.entries(normalizedOpenings).reduce((acc, [dateOnly, opening]) => {
      if (opening.allProfessionals) {
        acc[dateOnly] = opening;
        return acc;
      }
      const barberIds = opening.barberIds.filter((barberId) => scopedBarberIds.has(barberId));
      if (barberIds.length > 0) {
        acc[dateOnly] = { ...opening, barberIds };
      }
      return acc;
    }, {} as ExtraordinaryOpeningsByDate);

    const existing = await this.prisma.shopSchedule.findUnique({
      where: { localId: params.localId },
      select: { data: true },
    });
    const schedule = existing
      ? normalizeSchedule(existing.data as Partial<BookingSchedulePolicy>)
      : cloneSchedule(DEFAULT_SHOP_SCHEDULE);
    schedule.extraordinaryOpenings = scopedOpenings;

    await this.prisma.shopSchedule.upsert({
      where: { localId: params.localId },
      update: { data: schedule as Prisma.InputJsonValue },
      create: { localId: params.localId, data: schedule as Prisma.InputJsonValue },
    });

    return cloneSchedule(schedule);
  }

  async findConflicts(params: {
    localId: string;
    dateOnly: string;
    timezone: string;
    allProfessionals: boolean;
    barberIds: string[];
  }): Promise<ExtraordinaryOpeningConflictSummary> {
    const requestedBarberIds = Array.from(new Set(params.barberIds.filter(Boolean)));
    const barbers = await this.prisma.barber.findMany({
      where: {
        localId: params.localId,
        isActive: true,
        isArchived: false,
        ...(params.allProfessionals ? {} : { id: { in: requestedBarberIds } }),
      },
      select: { id: true },
    });
    const barberIds = barbers.map((barber) => barber.id);
    const dayStart = startOfDayInTimeZone(params.dateOnly, params.timezone);
    const dayEnd = endOfDayInTimeZone(params.dateOnly, params.timezone);

    const [generalHoliday, barberHolidays, closures] = await Promise.all([
      this.prisma.generalHoliday.findFirst({
        where: {
          localId: params.localId,
          start: { lte: dayEnd },
          end: { gte: dayStart },
        },
        select: { id: true },
      }),
      barberIds.length > 0
        ? this.prisma.barberHoliday.findMany({
          where: {
            localId: params.localId,
            barberId: { in: barberIds },
            start: { lte: dayEnd },
            end: { gte: dayStart },
          },
          select: { barberId: true },
        })
        : Promise.resolve([]),
      this.prisma.bookingClosure.findMany({
        where: {
          localId: params.localId,
          startDateTime: { lte: dayEnd },
          endDateTime: { gt: dayStart },
          OR: [
            { barberId: null },
            ...(barberIds.length > 0 ? [{ barberId: { in: barberIds } }] : []),
          ],
        },
        select: { barberId: true },
      }),
    ]);

    return {
      generalHoliday: Boolean(generalHoliday),
      generalClosure: closures.some((closure) => closure.barberId === null),
      barberHolidayIds: Array.from(new Set(barberHolidays.map((holiday) => holiday.barberId))).sort(),
      barberClosureIds: Array.from(new Set(
        closures
          .map((closure) => closure.barberId)
          .filter((barberId): barberId is string => Boolean(barberId)),
      )).sort(),
    };
  }
}
