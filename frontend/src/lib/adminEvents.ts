import { SiteSettings } from '@/data/types';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { getStoredLocalId } from '@/lib/tenant';

export const ADMIN_EVENTS = {
  appointmentsUpdated: 'admin:appointments-updated',
  usersUpdated: 'admin:users-updated',
  holidaysUpdated: 'admin:holidays-updated',
  alertsUpdated: 'admin:alerts-updated',
  servicesUpdated: 'admin:services-updated',
  barbersUpdated: 'admin:barbers-updated',
  schedulesUpdated: 'admin:schedules-updated',
  productsUpdated: 'admin:products-updated',
} as const;

export const SITE_SETTINGS_UPDATED_EVENT = 'site-settings-updated';

type AdminEventDetail = Record<string, unknown> & { localId?: string | null };

const resolveLocalScopeKey = (localId?: string | null) => localId || 'default';

const invalidateByPrefix = (prefix: string, options?: { localId?: string | null }) => {
  const scopedLocalId = options?.localId ?? getStoredLocalId();
  const localScopeKey = resolveLocalScopeKey(scopedLocalId);
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== prefix) return false;
      if (key.length < 2) return true;
      return key[1] === localScopeKey;
    },
  });
};

const invalidateServicesCatalog = (localId?: string | null) => {
  invalidateByPrefix('services', { localId });
  invalidateByPrefix('service-categories', { localId });
};

const invalidateBarbersCatalog = (localId?: string | null) => {
  invalidateByPrefix('barbers', { localId });
};

const invalidateProductsCatalog = (localId?: string | null) => {
  invalidateByPrefix('products', { localId });
  invalidateByPrefix('products-admin', { localId });
  invalidateByPrefix('product-categories', { localId });
};

export const dispatchAppointmentsUpdated = (detail?: AdminEventDetail) => {
  invalidateByPrefix('appointments', { localId: detail?.localId });
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.appointmentsUpdated, { detail }));
};

export const dispatchUsersUpdated = (detail?: AdminEventDetail) => {
  invalidateByPrefix('users', { localId: detail?.localId });
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.usersUpdated, { detail }));
};

export const dispatchHolidaysUpdated = (detail?: AdminEventDetail) => {
  invalidateByPrefix('holidays', { localId: detail?.localId });
  invalidateBarbersCatalog(detail?.localId);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.holidaysUpdated, { detail }));
};

export const dispatchAlertsUpdated = (detail?: AdminEventDetail) => {
  invalidateByPrefix('alerts', { localId: detail?.localId });
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.alertsUpdated, { detail }));
};

export const dispatchServicesUpdated = (detail?: AdminEventDetail) => {
  invalidateServicesCatalog(detail?.localId);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.servicesUpdated, { detail }));
};

export const dispatchBarbersUpdated = (detail?: AdminEventDetail) => {
  invalidateBarbersCatalog(detail?.localId);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.barbersUpdated, { detail }));
};

export const dispatchSchedulesUpdated = (detail?: AdminEventDetail) => {
  invalidateBarbersCatalog(detail?.localId);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.schedulesUpdated, { detail }));
};

export const dispatchProductsUpdated = (detail?: AdminEventDetail) => {
  invalidateProductsCatalog(detail?.localId);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.productsUpdated, { detail }));
};

export const dispatchSiteSettingsUpdated = (settings: SiteSettings) => {
  const localId = getStoredLocalId();
  queryClient.setQueryData(queryKeys.siteSettings(localId), settings);
  invalidateByPrefix('site-settings', { localId });
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SITE_SETTINGS_UPDATED_EVENT, { detail: settings }));
};
