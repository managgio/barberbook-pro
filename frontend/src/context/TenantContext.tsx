import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TenantBootstrap, Location } from '@/data/types';
import { getTenantBootstrap } from '@/data/api';
import { getStoredLocalId, setStoredLocalId } from '@/lib/tenant';
import { initFirebase } from '@/lib/firebaseConfig';
import { applyTheme, MANAGGIO_PRIMARY } from '@/lib/theme';

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

const resolveLocalId = (bootstrap: TenantBootstrap) => {
  const stored = getStoredLocalId();
  const availableIds = new Set(bootstrap.locations.map((loc) => loc.id));
  if (stored && availableIds.has(stored)) return stored;
  if (bootstrap.brand?.defaultLocationId && availableIds.has(bootstrap.brand.defaultLocationId)) {
    return bootstrap.brand.defaultLocationId;
  }
  return bootstrap.locations[0]?.id || bootstrap.currentLocalId;
};

const getFirebaseFallback = () => ({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
});

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

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantBootstrap | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [tenantError, setTenantError] = useState<TenantError | null>(null);

  const refreshTenant = async () => {
    setTenantError(null);
    try {
      const bootstrap = await getTenantBootstrap();
      const resolvedLocalId = resolveLocalId(bootstrap);
      setStoredLocalId(resolvedLocalId);
      setTenant(bootstrap);
      setCurrentLocationId(resolvedLocalId);
      const tenantTheme = bootstrap.isPlatform ? MANAGGIO_PRIMARY : bootstrap.config?.theme?.primary;
      applyTheme(tenantTheme);
      if (bootstrap.isPlatform && typeof document !== 'undefined') {
        const root = document.documentElement;
        root.style.setProperty('--primary-foreground', '0 0% 10%');
        root.style.setProperty('--accent-foreground', '0 0% 10%');
        root.style.setProperty('--sidebar-primary-foreground', '0 0% 10%');
      }
      const fallback = getFirebaseFallback();
      if (fallback?.apiKey) {
        initFirebase(fallback);
      }
      setIsReady(true);
    } catch (error) {
      console.error('Error cargando tenant', error);
      setTenantError(resolveTenantError(error));
      setIsReady(true);
    }
  };

  useEffect(() => {
    refreshTenant();
  }, []);

  const selectLocation = (localId: string) => {
    if (!tenant) return;
    setStoredLocalId(localId);
    setCurrentLocationId(localId);
    refreshTenant();
  };

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
    [tenant, currentLocationId, isReady, tenantError],
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
