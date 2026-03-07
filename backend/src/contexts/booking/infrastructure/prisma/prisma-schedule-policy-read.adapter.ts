import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BookingSchedulePolicy } from '../../domain/value-objects/schedule';
import { SchedulePolicyReadPort } from '../../ports/outbound/schedule-read.port';
import { DEFAULT_SHOP_SCHEDULE, cloneSchedule, normalizeSchedule } from './support/schedule.policy';

@Injectable()
export class PrismaSchedulePolicyReadAdapter implements SchedulePolicyReadPort {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureShopSchedule(localId: string): Promise<BookingSchedulePolicy> {
    const existing = await this.prisma.shopSchedule.findUnique({ where: { localId } });
    if (existing) {
      return normalizeSchedule(existing.data as Partial<BookingSchedulePolicy>) as BookingSchedulePolicy;
    }

    await this.prisma.shopSchedule.create({
      data: { localId, data: DEFAULT_SHOP_SCHEDULE },
    });

    return cloneSchedule(DEFAULT_SHOP_SCHEDULE) as BookingSchedulePolicy;
  }

  async getShopSchedule(params: { localId: string }): Promise<BookingSchedulePolicy> {
    return this.ensureShopSchedule(params.localId);
  }

  async getBarberSchedule(params: { localId: string; barberId: string }): Promise<BookingSchedulePolicy> {
    const record = await this.prisma.barberSchedule.findFirst({
      where: { localId: params.localId, barberId: params.barberId },
    });

    if (!record) {
      return this.ensureShopSchedule(params.localId);
    }

    return normalizeSchedule(record.data as Partial<BookingSchedulePolicy>, {
      preserveEndOverflowUndefined: true,
    }) as BookingSchedulePolicy;
  }

  async getBarberSchedules(params: { localId: string; barberIds: string[] }): Promise<Record<string, BookingSchedulePolicy>> {
    const entries = await Promise.all(
      params.barberIds.map(async (barberId) => [
        barberId,
        await this.getBarberSchedule({ localId: params.localId, barberId }),
      ] as const),
    );

    return Object.fromEntries(entries);
  }
}
