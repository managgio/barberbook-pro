import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { BookingSchedulePolicy } from '../../domain/value-objects/schedule';
import { ScheduleManagementPort } from '../../ports/outbound/schedule-management.port';
import { DEFAULT_SHOP_SCHEDULE, DAY_KEYS, cloneSchedule, normalizeSchedule } from './support/schedule.policy';

@Injectable()
export class PrismaScheduleManagementAdapter implements ScheduleManagementPort {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureShopSchedule(localId: string): Promise<BookingSchedulePolicy> {
    const existing = await this.prisma.shopSchedule.findUnique({ where: { localId } });
    if (existing) {
      return normalizeSchedule(existing.data as Partial<BookingSchedulePolicy>) as BookingSchedulePolicy;
    }

    await this.prisma.shopSchedule.create({ data: { localId, data: DEFAULT_SHOP_SCHEDULE } });
    return cloneSchedule(DEFAULT_SHOP_SCHEDULE) as BookingSchedulePolicy;
  }

  async getShopSchedule(params: { localId: string }): Promise<BookingSchedulePolicy> {
    const schedule = await this.ensureShopSchedule(params.localId);
    return cloneSchedule(schedule) as BookingSchedulePolicy;
  }

  async updateShopSchedule(params: { localId: string; schedule: BookingSchedulePolicy }): Promise<BookingSchedulePolicy> {
    const normalized = normalizeSchedule(params.schedule) as BookingSchedulePolicy;
    await this.prisma.shopSchedule.upsert({
      where: { localId: params.localId },
      update: { data: normalized },
      create: { localId: params.localId, data: normalized },
    });

    const existingSettings = await this.prisma.siteSettings.findUnique({
      where: { localId: params.localId },
    });
    if (existingSettings) {
      const openingHours = DAY_KEYS.reduce((acc, key) => {
        (acc as any)[key] = (normalized as any)[key];
        return acc;
      }, {} as Record<string, unknown>);
      const mergedData = {
        ...(existingSettings.data as Record<string, unknown>),
        openingHours,
      } as Prisma.InputJsonValue;

      await this.prisma.siteSettings.update({
        where: { localId: params.localId },
        data: {
          data: mergedData,
        },
      });
    }

    return cloneSchedule(normalized) as BookingSchedulePolicy;
  }

  async getBarberSchedule(params: { localId: string; barberId: string }): Promise<BookingSchedulePolicy> {
    const record = await this.prisma.barberSchedule.findFirst({
      where: { localId: params.localId, barberId: params.barberId },
    });

    if (!record) {
      const shopSchedule = await this.ensureShopSchedule(params.localId);
      return cloneSchedule(shopSchedule) as BookingSchedulePolicy;
    }

    return normalizeSchedule(record.data as Partial<BookingSchedulePolicy>, {
      preserveEndOverflowUndefined: true,
    }) as BookingSchedulePolicy;
  }

  async updateBarberSchedule(params: {
    localId: string;
    barberId: string;
    schedule: BookingSchedulePolicy;
  }): Promise<BookingSchedulePolicy> {
    const normalized = normalizeSchedule(params.schedule, {
      preserveEndOverflowUndefined: true,
    }) as BookingSchedulePolicy;

    await this.prisma.barberSchedule.upsert({
      where: { barberId: params.barberId },
      update: { data: normalized },
      create: { barberId: params.barberId, localId: params.localId, data: normalized },
    });

    return cloneSchedule(normalized) as BookingSchedulePolicy;
  }
}
