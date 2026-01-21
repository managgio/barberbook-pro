import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { SiteSettings, normalizeSettings } from '../settings/settings.types';

export const areServiceCategoriesEnabled = async (prisma: PrismaService): Promise<boolean> => {
  const localId = getCurrentLocalId();
  const settings = await prisma.siteSettings.findUnique({ where: { localId } });
  const normalized = normalizeSettings((settings?.data || undefined) as Partial<SiteSettings> | undefined);
  return normalized.services.categoriesEnabled;
};
