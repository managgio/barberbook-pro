import { PrismaService } from '../../../../../prisma/prisma.service';

type ProductScope = {
  localId: string;
  brandId: string;
};

type NormalizedServicesSettings = {
  categoriesEnabled: boolean;
  barberServiceAssignmentEnabled: boolean;
};

type NormalizedProductsSettings = {
  enabled: boolean;
  categoriesEnabled: boolean;
  clientPurchaseEnabled: boolean;
  showOnLanding: boolean;
};

type NormalizedSiteSettings = {
  services: NormalizedServicesSettings;
  products: NormalizedProductsSettings;
};

const DEFAULT_SITE_SETTINGS: NormalizedSiteSettings = {
  services: {
    categoriesEnabled: false,
    barberServiceAssignmentEnabled: false,
  },
  products: {
    enabled: false,
    categoriesEnabled: false,
    clientPurchaseEnabled: false,
    showOnLanding: false,
  },
};

const normalizeSiteSettings = (data: unknown): NormalizedSiteSettings => {
  const settings = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const services = (settings.services && typeof settings.services === 'object'
    ? settings.services
    : {}) as Record<string, unknown>;
  const products = (settings.products && typeof settings.products === 'object'
    ? settings.products
    : {}) as Record<string, unknown>;

  return {
    services: {
      categoriesEnabled:
        typeof services.categoriesEnabled === 'boolean'
          ? services.categoriesEnabled
          : DEFAULT_SITE_SETTINGS.services.categoriesEnabled,
      barberServiceAssignmentEnabled:
        typeof services.barberServiceAssignmentEnabled === 'boolean'
          ? services.barberServiceAssignmentEnabled
          : DEFAULT_SITE_SETTINGS.services.barberServiceAssignmentEnabled,
    },
    products: {
      enabled:
        typeof products.enabled === 'boolean' ? products.enabled : DEFAULT_SITE_SETTINGS.products.enabled,
      categoriesEnabled:
        typeof products.categoriesEnabled === 'boolean'
          ? products.categoriesEnabled
          : DEFAULT_SITE_SETTINGS.products.categoriesEnabled,
      clientPurchaseEnabled:
        typeof products.clientPurchaseEnabled === 'boolean'
          ? products.clientPurchaseEnabled
          : DEFAULT_SITE_SETTINGS.products.clientPurchaseEnabled,
      showOnLanding:
        typeof products.showOnLanding === 'boolean'
          ? products.showOnLanding
          : DEFAULT_SITE_SETTINGS.products.showOnLanding,
    },
  };
};

const getHiddenSections = async (prisma: PrismaService, scope: ProductScope): Promise<string[]> => {
  const [brandConfig, locationConfig] = await Promise.all([
    prisma.brandConfig.findUnique({ where: { brandId: scope.brandId }, select: { data: true } }),
    prisma.locationConfig.findUnique({ where: { localId: scope.localId }, select: { data: true } }),
  ]);

  const brandHidden = (brandConfig?.data as any)?.adminSidebar?.hiddenSections;
  const locationHidden = (locationConfig?.data as any)?.adminSidebar?.hiddenSections;
  if (Array.isArray(locationHidden)) return locationHidden;
  if (Array.isArray(brandHidden)) return brandHidden;
  return [];
};

export const areServiceCategoriesEnabled = async (
  prisma: PrismaService,
  localId: string,
): Promise<boolean> => {
  const settings = await prisma.siteSettings.findUnique({
    where: { localId },
    select: { data: true },
  });
  const normalized = normalizeSiteSettings(settings?.data);
  return normalized.services.categoriesEnabled;
};

export const getProductSettings = async (
  prisma: PrismaService,
  scope: ProductScope,
): Promise<NormalizedProductsSettings> => {
  const [siteSettings, hiddenSections] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { localId: scope.localId }, select: { data: true } }),
    getHiddenSections(prisma, scope),
  ]);
  const normalized = normalizeSiteSettings(siteSettings?.data);
  const moduleEnabled = !hiddenSections.includes('stock');

  return {
    ...normalized.products,
    enabled: moduleEnabled,
  };
};

export const areProductCategoriesEnabled = async (
  prisma: PrismaService,
  scope: ProductScope,
): Promise<boolean> => {
  const products = await getProductSettings(prisma, scope);
  return products.categoriesEnabled;
};
