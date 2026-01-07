import { PrismaService } from '../../prisma/prisma.service';
import { SiteSettings, normalizeSettings } from '../settings/settings.types';

export const areServiceCategoriesEnabled = async (prisma: PrismaService): Promise<boolean> => {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const normalized = normalizeSettings((settings?.data || undefined) as Partial<SiteSettings> | undefined);
  return normalized.services.categoriesEnabled;
};
