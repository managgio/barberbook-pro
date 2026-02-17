import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Location, SiteSettings, TenantBootstrap } from '@/data/types';
import { getTenantBootstrap } from '@/data/api/tenant';
import { getStoredLocalId, setStoredLocalId } from '@/lib/tenant';
import { applyTheme, applyThemeMode, MANAGGIO_PRIMARY } from '@/lib/theme';
import { resolveBrandLogo } from '@/lib/branding';
import managgioLogo from '@/assets/img/managgio/logo.webp';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import { SITE_SETTINGS_UPDATED_EVENT } from '@/lib/adminEvents';

interface TenantContextValue {
  tenant: TenantBootstrap | null;
  locations: Location[];
  currentLocationId: string | null;
  isReady: boolean;
  tenantError: TenantError | null;
  selectLocation: (localId: string) => void;
  refreshTenant: () => Promise<void>;
}

type TenantErrorCode = 'missing-subdomain' | 'not-found' | 'unknown';

type TenantError = {
  code: TenantErrorCode;
  message: string;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);
const DEFAULT_FAVICON = managgioLogo;
const PLATFORM_TITLE = 'Managgio | Plataforma';
const PLATFORM_DESCRIPTION = 'Panel de plataforma para gestionar marcas, locales y credenciales en Managgio.';

const resolveLocalId = (bootstrap: TenantBootstrap) => {
  const stored = getStoredLocalId();
  const availableIds = new Set(bootstrap.locations.map((loc) => loc.id));
  if (stored && availableIds.has(stored)) return stored;
  if (bootstrap.brand?.defaultLocationId && availableIds.has(bootstrap.brand.defaultLocationId)) {
    return bootstrap.brand.defaultLocationId;
  }
  return bootstrap.locations[0]?.id || bootstrap.currentLocalId;
};

const resolveTenantError = (error: unknown): TenantError => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('TENANT_SUBDOMAIN_REQUIRED')) {
    return {
      code: 'missing-subdomain',
      message: 'Este sitio requiere un subdominio válido.',
    };
  }
  if (message.includes('TENANT_NOT_FOUND')) {
    return {
      code: 'not-found',
      message: 'No existe un cliente con ese subdominio.',
    };
  }
  return {
    code: 'unknown',
    message: 'No se pudo cargar la información del cliente.',
  };
};

const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
  if (typeof document === 'undefined') return;
  const selector = `meta[${attr}="${key}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const upsertLink = (rel: string, href: string, type?: string) => {
  if (typeof document === 'undefined') return;
  const selector = `link[rel="${rel}"]`;
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
  if (type) element.setAttribute('type', type);
  else element.removeAttribute('type');
};

const removeMeta = (attr: 'name' | 'property', key: string) => {
  if (typeof document === 'undefined') return;
  const selector = `meta[${attr}="${key}"]`;
  const element = document.head.querySelector(selector);
  if (element) element.remove();
};

const resolveMetaText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const resolveImageUrl = (source: string) => {
  if (!source) return '';
  if (/^https?:\/\//i.test(source) || source.startsWith('data:')) return source;
  if (typeof window === 'undefined') return source;
  return new URL(source, window.location.origin).toString();
};

const resolveIconType = (source: string) => {
  const clean = source.toLowerCase();
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.ico')) return 'image/x-icon';
  return undefined;
};

const resolveTwitterHandle = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const handle = url.pathname.replace(/^\/+/, '').split('/')[0];
      const clean = handle.replace(/^@+/, '');
      return clean ? `@${clean}` : '';
    } catch {
      return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    }
  }
  const clean = trimmed.replace(/^@+/, '');
  return clean ? `@${clean}` : '';
};

const applyMeta = (payload: {
  title: string;
  description: string;
  imageUrl: string;
  author?: string;
  twitterSite?: string;
}) => {
  if (typeof document === 'undefined') return;
  const resolvedImage = resolveImageUrl(payload.imageUrl);
  const iconType = resolveIconType(resolvedImage);
  document.title = payload.title;
  upsertMeta('name', 'description', payload.description);
  if (payload.author) upsertMeta('name', 'author', payload.author);
  upsertMeta('property', 'og:title', payload.title);
  upsertMeta('property', 'og:description', payload.description);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:image', resolvedImage);
  upsertMeta('name', 'twitter:title', payload.title);
  upsertMeta('name', 'twitter:description', payload.description);
  upsertMeta('name', 'twitter:image', resolvedImage);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  if (payload.twitterSite) upsertMeta('name', 'twitter:site', payload.twitterSite);
  else removeMeta('name', 'twitter:site');
  upsertLink('icon', resolvedImage, iconType);
  upsertLink('apple-touch-icon', resolvedImage);
};

const buildTenantMeta = (bootstrap: TenantBootstrap, settings?: SiteSettings | null) => {
  const isPlatform = Boolean(bootstrap.isPlatform);
  if (isPlatform) {
    return {
      title: PLATFORM_TITLE,
      description: PLATFORM_DESCRIPTION,
      imageUrl: managgioLogo,
      author: 'Managgio',
    };
  }

  const branding = settings?.branding;
  const brandName = resolveMetaText(branding?.name, bootstrap.config?.branding?.name, bootstrap.brand?.name, 'Managgio');
  const tagline = resolveMetaText(branding?.tagline);
  const description = resolveMetaText(branding?.description, tagline, `${brandName} · Gestión de citas y servicios.`);
  const imageUrl = resolveBrandLogo(bootstrap, DEFAULT_FAVICON);
  const title = tagline ? `${brandName} | ${tagline}` : brandName;
  const twitterSite = resolveTwitterHandle(settings?.socials?.x);

  return {
    title,
    description,
    imageUrl,
    author: brandName,
    twitterSite,
  };
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantBootstrap | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [tenantError, setTenantError] = useState<TenantError | null>(null);

  const refreshTenant = useCallback(async () => {
    setTenantError(null);
    try {
      const bootstrap = await getTenantBootstrap();
      const resolvedLocalId = resolveLocalId(bootstrap);
      setStoredLocalId(resolvedLocalId);
      setTenant(bootstrap);
      setCurrentLocationId(resolvedLocalId);
      applyMeta(buildTenantMeta(bootstrap));
      const tenantTheme = bootstrap.isPlatform ? MANAGGIO_PRIMARY : bootstrap.config?.theme?.primary;
      const themeMode = bootstrap.isPlatform ? 'dark' : bootstrap.config?.theme?.mode;
      applyThemeMode(themeMode);
      applyTheme(tenantTheme);
      if (bootstrap.isPlatform && typeof document !== 'undefined') {
        const root = document.documentElement;
        root.style.setProperty('--primary-foreground', '0 0% 10%');
        root.style.setProperty('--accent-foreground', '0 0% 10%');
        root.style.setProperty('--sidebar-primary-foreground', '0 0% 10%');
      }
      setIsReady(true);
      if (!bootstrap.isPlatform) {
        void (async () => {
          try {
            const settings = await fetchSiteSettingsCached(resolvedLocalId);
            applyMeta(buildTenantMeta(bootstrap, settings));
          } catch (error) {
            console.error('Error cargando metadatos del cliente', error);
          }
        })();
      }
    } catch (error) {
      console.error('Error cargando tenant', error);
      setTenantError(resolveTenantError(error));
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshTenant();
  }, [refreshTenant]);

  useEffect(() => {
    if (!tenant || tenant.isPlatform || typeof window === 'undefined') return;
    const handleSettingsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<SiteSettings>;
      if (!customEvent.detail) return;
      applyMeta(buildTenantMeta(tenant, customEvent.detail));
    };
    window.addEventListener(SITE_SETTINGS_UPDATED_EVENT, handleSettingsUpdate as EventListener);
    return () => window.removeEventListener(SITE_SETTINGS_UPDATED_EVENT, handleSettingsUpdate as EventListener);
  }, [tenant]);

  const selectLocation = useCallback((localId: string) => {
    if (!tenant) return;
    setStoredLocalId(localId);
    setCurrentLocationId(localId);
    void refreshTenant();
  }, [tenant, refreshTenant]);

  const value = useMemo(
    () => ({
      tenant,
      locations: tenant?.locations || [],
      currentLocationId,
      isReady,
      tenantError,
      selectLocation,
      refreshTenant,
    }),
    [tenant, currentLocationId, isReady, tenantError, selectLocation, refreshTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
