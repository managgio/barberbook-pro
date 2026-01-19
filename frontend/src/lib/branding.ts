import { TenantBootstrap } from '@/data/types';

export const resolveBrandLogo = (tenant: TenantBootstrap | null, fallback: string) => {
  const branding = tenant?.config?.branding;
  if (!branding) return fallback;
  const mode = tenant?.config?.theme?.mode === 'light' ? 'light' : 'dark';
  const modeLogo = mode === 'light' ? branding.logoLightUrl : branding.logoDarkUrl;
  return modeLogo || branding.logoUrl || fallback;
};
