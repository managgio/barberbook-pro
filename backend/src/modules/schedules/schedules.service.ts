import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_SHOP_SCHEDULE, ShopSchedule } from './schedule.types';
import { cloneSchedule, normalizeSchedule } from './schedule.utils';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureShopSchedule(): Promise<ShopSchedule> {
    const existing = await this.prisma.shopSchedule.findUnique({ where: { id: 1 } });
    if (existing) {
      return normalizeSchedule(existing.data as Partial<ShopSchedule>);
    }
    await this.prisma.shopSchedule.create({ data: { id: 1, data: DEFAULT_SHOP_SCHEDULE } });
    return cloneSchedule(DEFAULT_SHOP_SCHEDULE);
  }

  async getShopSchedule(): Promise<ShopSchedule> {
    const schedule = await this.ensureShopSchedule();
    return cloneSchedule(schedule);
  }

  async updateShopSchedule(schedule: ShopSchedule): Promise<ShopSchedule> {
    const normalized = normalizeSchedule(schedule);
    await this.prisma.shopSchedule.upsert({
      where: { id: 1 },
      update: { data: normalized },
      create: { id: 1, data: normalized },
    });
    const existingSettings = await this.prisma.siteSettings.findUnique({ where: { id: 1 } });
    if (existingSettings) {
      await this.prisma.siteSettings.update({
        where: { id: 1 },
        data: { data: { ...(existingSettings.data as Record<string, unknown>), openingHours: normalized } },
      });
    }
    return cloneSchedule(normalized);
  }

  async getBarberSchedule(barberId: string): Promise<ShopSchedule> {
    const record = await this.prisma.barberSchedule.findUnique({ where: { barberId } });
    if (!record) {
      return cloneSchedule(DEFAULT_SHOP_SCHEDULE);
    }
    return normalizeSchedule(record.data as Partial<ShopSchedule>);
  }

  async updateBarberSchedule(barberId: string, schedule: ShopSchedule): Promise<ShopSchedule> {
    const normalized = normalizeSchedule(schedule);
    await this.prisma.barberSchedule.upsert({
      where: { barberId },
      update: { data: normalized },
      create: { barberId, data: normalized },
    });
    return cloneSchedule(normalized);
  }
}
