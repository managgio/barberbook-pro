import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { SiteSettings, normalizeSettings, cloneSettings } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSettings(): Promise<SiteSettings> {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.siteSettings.findUnique({ where: { localId } });
    if (!existing) {
      const shopSchedule = await this.prisma.shopSchedule.findUnique({ where: { localId } });
      const defaults = normalizeSettings({
        openingHours: (shopSchedule?.data || undefined) as SiteSettings['openingHours'] | undefined,
      });
      await this.prisma.siteSettings.create({ data: { localId, data: defaults } });
      return defaults;
    }
    return normalizeSettings(existing.data as Partial<SiteSettings>);
  }

  async getSettings(): Promise<SiteSettings> {
    const settings = await this.ensureSettings();
    return cloneSettings(settings);
  }

  async updateSettings(settings: SiteSettings): Promise<SiteSettings> {
    const localId = getCurrentLocalId();
    const normalized = normalizeSettings(settings);

    if (normalized.services.categoriesEnabled) {
      const uncategorized = await this.prisma.service.count({
        where: { categoryId: null, localId },
      });
      if (uncategorized > 0) {
        throw new BadRequestException(
          'Asigna una categoría a todos los servicios antes de activar la categorización.',
        );
      }
    }

    await this.prisma.siteSettings.upsert({
      where: { localId },
      update: { data: normalized },
      create: { localId, data: normalized },
    });
    await this.prisma.shopSchedule.upsert({
      where: { localId },
      update: { data: normalized.openingHours },
      create: { localId, data: normalized.openingHours },
    });
    return cloneSettings(normalized);
  }
}
