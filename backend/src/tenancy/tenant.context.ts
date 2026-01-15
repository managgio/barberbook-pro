import { AsyncLocalStorage } from 'node:async_hooks';
import { DEFAULT_BRAND_ID, DEFAULT_LOCAL_ID } from './tenant.constants';

export type TenantContext = {
  brandId?: string;
  localId?: string;
  host?: string;
  subdomain?: string | null;
  isPlatform?: boolean;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const runWithTenantContext = (context: TenantContext, fn: () => void) => {
  tenantStorage.run(context, fn);
};

export const getTenantContext = (): TenantContext => tenantStorage.getStore() || {};

export const getCurrentBrandId = (): string =>
  getTenantContext().brandId || DEFAULT_BRAND_ID;

export const getCurrentLocalId = (): string =>
  getTenantContext().localId || DEFAULT_LOCAL_ID;

export const isPlatformRequest = (): boolean => Boolean(getTenantContext().isPlatform);
