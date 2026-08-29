export const PLATFORM_BRAND_TABS = [
  'datos',
  'locales',
  'admins',
  'sidebar',
  'landing',
  'config',
  'idiomas',
  'legal',
] as const;

export type PlatformBrandTab = (typeof PLATFORM_BRAND_TABS)[number];

export const PLATFORM_BRAND_TAB_LABELS: Record<PlatformBrandTab, string> = {
  datos: 'Datos',
  locales: 'Locales',
  admins: 'Admins',
  sidebar: 'Sidebar',
  landing: 'Landing',
  config: 'Config',
  idiomas: 'Idiomas',
  legal: 'Legal',
};
