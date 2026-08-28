import { BadRequestException, Injectable } from '@nestjs/common';
import { CommunicationCampaign, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  APP_TIMEZONE,
  getWeekdayKey,
  makeDateInTimeZone,
  startOfDayInTimeZone,
} from '../../utils/timezone';
import { DEFAULT_SHOP_SCHEDULE, DayKey } from '../schedules/schedule.types';
import { CommunicationPayloadDto } from './dto/communication-payload.dto';

type ClosureInput = {
  localId: string;
  barberId: string | null;
  campaignId: string;
  startDateTime: Date;
  endDateTime: Date;
};

@Injectable()
export class CommunicationBookingClosureService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureForCampaign(
    campaign: Pick<CommunicationCampaign, 'id' | 'localId'>,
    payload: CommunicationPayloadDto,
  ): Promise<number> {
    const existing = await this.prisma.bookingClosure.findFirst({
      where: { campaignId: campaign.id },
      select: { id: true },
    });
    if (existing) return 0;

    const closures = await this.resolveClosures(campaign, payload);
    if (closures.length === 0) return 0;
    const created = await this.prisma.bookingClosure.createMany({ data: closures });
    return created.count;
  }

  private async resolveClosures(
    campaign: Pick<CommunicationCampaign, 'id' | 'localId'>,
    payload: CommunicationPayloadDto,
  ): Promise<ClosureInput[]> {
    const base = { localId: campaign.localId, campaignId: campaign.id };

    if (payload.scopeType === 'all_day') {
      const range = this.resolveFullDayRange(payload.scopeCriteria);
      return [{ ...base, barberId: null, ...range }];
    }

    if (payload.scopeType === 'appointments_morning' || payload.scopeType === 'appointments_afternoon') {
      const date = payload.scopeCriteria.date;
      if (!date) throw new BadRequestException('Debes indicar la fecha del periodo.');
      const shift = await this.resolveShiftRangeForDate(
        campaign.localId,
        date,
        payload.scopeType === 'appointments_morning' ? 'morning' : 'afternoon',
      );
      return shift ? [{ ...base, barberId: null, startDateTime: shift.start, endDateTime: shift.end }] : [];
    }

    if (payload.scopeType === 'day_time_range') {
      const { date, startTime, endTime } = payload.scopeCriteria;
      if (!date || !startTime || !endTime) {
        throw new BadRequestException('Debes indicar fecha y rango horario.');
      }
      const startDateTime = this.buildDateFromClock(date, startTime);
      const endDateTime = this.buildDateFromClock(date, endTime);
      if (!startDateTime || !endDateTime || endDateTime <= startDateTime) {
        throw new BadRequestException('El rango horario es inválido.');
      }
      return [{ ...base, barberId: null, startDateTime, endDateTime }];
    }

    if (payload.scopeType === 'professional_single' || payload.scopeType === 'professional_multi') {
      const requestedIds = payload.scopeType === 'professional_single'
        ? [payload.scopeCriteria.barberId || ''].filter(Boolean)
        : Array.from(new Set(payload.scopeCriteria.barberIds || [])).filter(Boolean);
      if (requestedIds.length === 0) throw new BadRequestException('Debes seleccionar al menos un profesional.');
      const localBarbers = await this.prisma.barber.findMany({
        where: { localId: campaign.localId, id: { in: requestedIds } },
        select: { id: true },
      });
      if (localBarbers.length !== requestedIds.length) {
        throw new BadRequestException('Algún profesional no pertenece al local actual.');
      }
      const range = this.resolveFullDayRange(payload.scopeCriteria);
      return localBarbers.map(({ id }) => ({ ...base, barberId: id, ...range }));
    }

    if (payload.scopeType === 'appointment_selection') {
      const appointmentIds = Array.from(new Set(payload.scopeCriteria.appointmentIds || [])).filter(Boolean);
      if (appointmentIds.length === 0) throw new BadRequestException('Debes seleccionar al menos una cita.');
      const appointments = await this.prisma.appointment.findMany({
        where: {
          id: { in: appointmentIds },
          localId: campaign.localId,
          status: 'scheduled',
        },
        select: {
          barberId: true,
          startDateTime: true,
          service: { select: { duration: true } },
        },
      });
      return appointments.map((appointment) => ({
        ...base,
        barberId: appointment.barberId,
        startDateTime: appointment.startDateTime,
        endDateTime: new Date(
          appointment.startDateTime.getTime() + Math.max(1, appointment.service.duration || 30) * 60_000,
        ),
      }));
    }

    return [];
  }

  private resolveFullDayRange(criteria: { date?: string; dateFrom?: string; dateTo?: string }) {
    const rawStart = criteria.dateFrom || criteria.date;
    const rawEnd = criteria.dateTo || criteria.date;
    if (!rawStart || !rawEnd) throw new BadRequestException('Debes indicar la fecha del periodo.');
    const start = rawStart <= rawEnd ? rawStart : rawEnd;
    const end = rawStart <= rawEnd ? rawEnd : rawStart;
    this.assertBoundedRange(start, end);
    return {
      startDateTime: startOfDayInTimeZone(start, APP_TIMEZONE),
      endDateTime: startOfDayInTimeZone(this.addDays(end, 1), APP_TIMEZONE),
    };
  }

  private addDays(dateOnly: string, amount: number) {
    const date = new Date(`${dateOnly}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('La fecha del periodo es inválida.');
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  private assertBoundedRange(start: string, end: string) {
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days < 1 || days > 366) {
      throw new BadRequestException('El periodo debe estar entre 1 y 366 días.');
    }
  }

  private async resolveShiftRangeForDate(
    localId: string,
    date: string,
    shiftType: 'morning' | 'afternoon',
  ) {
    const dayKey = getWeekdayKey(date, APP_TIMEZONE);
    const fallbackDay = DEFAULT_SHOP_SCHEDULE[dayKey];
    const shopSchedule = await this.prisma.shopSchedule.findUnique({
      where: { localId },
      select: { data: true },
    });
    const daySchedule = this.extractDaySchedule(shopSchedule?.data, dayKey);
    if ((daySchedule?.closed ?? fallbackDay.closed) === true) return null;
    const configuredShift = daySchedule?.[shiftType];
    const fallbackShift = fallbackDay[shiftType];
    if ((configuredShift?.enabled ?? fallbackShift.enabled) !== true) return null;
    const start = this.buildDateFromClock(date, configuredShift?.start || fallbackShift.start);
    const end = this.buildDateFromClock(date, configuredShift?.end || fallbackShift.end);
    return start && end && end > start ? { start, end } : null;
  }

  private extractDaySchedule(data: Prisma.JsonValue | null | undefined, dayKey: DayKey) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const day = (data as Record<string, unknown>)[dayKey];
    if (!day || typeof day !== 'object' || Array.isArray(day)) return null;
    return day as {
      closed?: boolean;
      morning?: { enabled?: boolean; start?: string; end?: string };
      afternoon?: { enabled?: boolean; start?: string; end?: string };
    };
  }

  private buildDateFromClock(date: string, rawClock: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(rawClock.trim());
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return makeDateInTimeZone(date, { hour, minute }, APP_TIMEZONE);
  }
}
