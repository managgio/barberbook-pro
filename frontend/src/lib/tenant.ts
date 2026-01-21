const LOCAL_STORAGE_KEY = 'managgio.localId';

export const getStoredLocalId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LOCAL_STORAGE_KEY);
};

export const setStoredLocalId = (localId: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, localId);
};

export const clearStoredLocalId = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
};

const resolveTenantSubdomainFromHost = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const hostname = window.location.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return undefined;
  const baseDomainRaw = import.meta.env.VITE_TENANT_BASE_DOMAIN as string | undefined;
  const baseDomain = baseDomainRaw?.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (baseDomain) {
    if (hostname === baseDomain) return undefined;
    if (hostname.endsWith(`.${baseDomain}`)) {
      const prefix = hostname.slice(0, -(baseDomain.length + 1));
      const subdomain = prefix.split('.')[0];
      return subdomain || undefined;
    }
    return undefined;
  }
  const parts = hostname.split('.');
  if (parts.length < 3) return undefined;
  return parts[0] || undefined;
};

export const getTenantSubdomainOverride = () => {
  const override = import.meta.env.VITE_TENANT_SUBDOMAIN as string | undefined;
  return override || resolveTenantSubdomainFromHost();
};
