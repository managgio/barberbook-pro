import { PrismaService } from '../../prisma/prisma.service';
import { SiteSettings, normalizeSettings } from '../settings/settings.types';

type ProductScope = {
  brandId: string;
  localId: string;
};

const getHiddenSections = async (prisma: PrismaService, scope: ProductScope): Promise<string[]> => {
  const { brandId, localId } = scope;
  const [brandConfig, locationConfig] = await Promise.all([
    prisma.brandConfig.findUnique({ where: { brandId }, select: { data: true } }),
    prisma.locationConfig.findUnique({ where: { localId }, select: { data: true } }),
  ]);
  const brandHidden = (brandConfig?.data as any)?.adminSidebar?.hiddenSections;
  const locationHidden = (locationConfig?.data as any)?.adminSidebar?.hiddenSections;
  if (Array.isArray(locationHidden)) return locationHidden;
  if (Array.isArray(brandHidden)) return brandHidden;
  return [];
};

export const getProductSettings = async (
  prisma: PrismaService,
  scope: ProductScope,
): Promise<SiteSettings['products']> => {
  const { localId } = scope;
  const settings = await prisma.siteSettings.findUnique({ where: { localId } });
  const normalized = normalizeSettings((settings?.data || undefined) as Partial<SiteSettings> | undefined);
  const hiddenSections = await getHiddenSections(prisma, scope);
  const moduleEnabled = !hiddenSections.includes('stock');
  return { ...normalized.products, enabled: moduleEnabled };
};

export const areProductCategoriesEnabled = async (
  prisma: PrismaService,
  scope: ProductScope,
): Promise<boolean> => {
  const products = await getProductSettings(prisma, scope);
  return products.categoriesEnabled;
};
