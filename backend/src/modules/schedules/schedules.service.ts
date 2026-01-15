import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { DEFAULT_SHOP_SCHEDULE, ShopSchedule } from './schedule.types';
import { cloneSchedule, normalizeSchedule } from './schedule.utils';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureShopSchedule(): Promise<ShopSchedule> {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.shopSchedule.findUnique({ where: { localId } });
    if (existing) {
      return normalizeSchedule(existing.data as Partial<ShopSchedule>);
    }
    await this.prisma.shopSchedule.create({ data: { localId, data: DEFAULT_SHOP_SCHEDULE } });
    return cloneSchedule(DEFAULT_SHOP_SCHEDULE);
  }

  async getShopSchedule(): Promise<ShopSchedule> {
    const schedule = await this.ensureShopSchedule();
    return cloneSchedule(schedule);
  }

  async updateShopSchedule(schedule: ShopSchedule): Promise<ShopSchedule> {
    const localId = getCurrentLocalId();
    const normalized = normalizeSchedule(schedule);
    await this.prisma.shopSchedule.upsert({
      where: { localId },
      update: { data: normalized },
      create: { localId, data: normalized },
    });
    const existingSettings = await this.prisma.siteSettings.findUnique({ where: { localId } });
    if (existingSettings) {
      await this.prisma.siteSettings.update({
        where: { localId },
        data: { data: { ...(existingSettings.data as Record<string, unknown>), openingHours: normalized } },
      });
    }
    return cloneSchedule(normalized);
  }

  async getBarberSchedule(barberId: string): Promise<ShopSchedule> {
    const record = await this.prisma.barberSchedule.findFirst({
      where: { barberId, localId: getCurrentLocalId() },
    });
    if (!record) {
      return cloneSchedule(DEFAULT_SHOP_SCHEDULE);
    }
    return normalizeSchedule(record.data as Partial<ShopSchedule>);
  }

  async updateBarberSchedule(barberId: string, schedule: ShopSchedule): Promise<ShopSchedule> {
    const localId = getCurrentLocalId();
    const normalized = normalizeSchedule(schedule);
    await this.prisma.barberSchedule.upsert({
      where: { barberId },
      update: { data: normalized },
      create: { barberId, localId, data: normalized },
    });
    return cloneSchedule(normalized);
  }
}
