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

export const getTenantSubdomainOverride = () => {
  return import.meta.env.VITE_TENANT_SUBDOMAIN as string | undefined;
};
