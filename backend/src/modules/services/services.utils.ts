import { PrismaService } from '../../prisma/prisma.service';
import { SiteSettings, normalizeSettings } from '../settings/settings.types';

export const areServiceCategoriesEnabled = async (
  prisma: PrismaService,
  localId: string,
): Promise<boolean> => {
  const settings = await prisma.siteSettings.findUnique({ where: { localId } });
  const normalized = normalizeSettings((settings?.data || undefined) as Partial<SiteSettings> | undefined);
  return normalized.services.categoriesEnabled;
};

export const isBarberServiceAssignmentEnabled = async (
  prisma: PrismaService,
  localId: string,
): Promise<boolean> => {
  const settings = await prisma.siteSettings.findUnique({ where: { localId } });
  const normalized = normalizeSettings((settings?.data || undefined) as Partial<SiteSettings> | undefined);
  return normalized.services.barberServiceAssignmentEnabled;
};
