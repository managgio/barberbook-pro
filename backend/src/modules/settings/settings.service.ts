import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SiteSettings, normalizeSettings, cloneSettings } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSettings(): Promise<SiteSettings> {
    const existing = await this.prisma.siteSettings.findUnique({ where: { id: 1 } });
    if (!existing) {
      const shopSchedule = await this.prisma.shopSchedule.findUnique({ where: { id: 1 } });
      const defaults = normalizeSettings({
        openingHours: (shopSchedule?.data || undefined) as SiteSettings['openingHours'] | undefined,
      });
      await this.prisma.siteSettings.create({ data: { id: 1, data: defaults } });
      return defaults;
    }
    return normalizeSettings(existing.data as Partial<SiteSettings>);
  }

  async getSettings(): Promise<SiteSettings> {
    const settings = await this.ensureSettings();
    return cloneSettings(settings);
  }

  async updateSettings(settings: SiteSettings): Promise<SiteSettings> {
    const normalized = normalizeSettings(settings);

    if (normalized.services.categoriesEnabled) {
      const uncategorized = await this.prisma.service.count({ where: { categoryId: null } });
      if (uncategorized > 0) {
        throw new BadRequestException(
          'Asigna una categoría a todos los servicios antes de activar la categorización.',
        );
      }
    }

    await this.prisma.siteSettings.upsert({
      where: { id: 1 },
      update: { data: normalized },
      create: { id: 1, data: normalized },
    });
    await this.prisma.shopSchedule.upsert({
      where: { id: 1 },
      update: { data: normalized.openingHours },
      create: { id: 1, data: normalized.openingHours },
    });
    return cloneSettings(normalized);
  }
}
