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

const invalidateByPrefix = (prefix: string) => {
  void queryClient.invalidateQueries({ queryKey: [prefix] });
};

const invalidateServicesCatalog = () => {
  invalidateByPrefix('services');
  invalidateByPrefix('service-categories');
};

const invalidateBarbersCatalog = () => {
  invalidateByPrefix('barbers');
};

const invalidateProductsCatalog = () => {
  invalidateByPrefix('products');
  invalidateByPrefix('products-admin');
  invalidateByPrefix('product-categories');
};

export const dispatchAppointmentsUpdated = (detail?: Record<string, unknown>) => {
  invalidateByPrefix('appointments');
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.appointmentsUpdated, { detail }));
};

export const dispatchUsersUpdated = (detail?: Record<string, unknown>) => {
  invalidateByPrefix('users');
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.usersUpdated, { detail }));
};

export const dispatchHolidaysUpdated = (detail?: Record<string, unknown>) => {
  invalidateByPrefix('holidays');
  invalidateBarbersCatalog();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.holidaysUpdated, { detail }));
};

export const dispatchAlertsUpdated = (detail?: Record<string, unknown>) => {
  invalidateByPrefix('alerts');
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.alertsUpdated, { detail }));
};

export const dispatchServicesUpdated = (detail?: Record<string, unknown>) => {
  invalidateServicesCatalog();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.servicesUpdated, { detail }));
};

export const dispatchBarbersUpdated = (detail?: Record<string, unknown>) => {
  invalidateBarbersCatalog();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.barbersUpdated, { detail }));
};

export const dispatchSchedulesUpdated = (detail?: Record<string, unknown>) => {
  invalidateBarbersCatalog();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.schedulesUpdated, { detail }));
};

export const dispatchProductsUpdated = (detail?: Record<string, unknown>) => {
  invalidateProductsCatalog();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.productsUpdated, { detail }));
};

export const dispatchSiteSettingsUpdated = (settings: SiteSettings) => {
  const localId = getStoredLocalId();
  queryClient.setQueryData(queryKeys.siteSettings(localId), settings);
  invalidateByPrefix('site-settings');
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SITE_SETTINGS_UPDATED_EVENT, { detail: settings }));
};
