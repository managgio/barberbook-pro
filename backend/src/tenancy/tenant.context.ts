import { AsyncLocalStorage } from 'node:async_hooks';
export type TenantContext = {
  brandId?: string;
  localId?: string;
  host?: string;
  subdomain?: string | null;
  requestedLanguage?: string | null;
  isPlatform?: boolean;
  scopeGuardBypass?: boolean;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const runWithTenantContext = (context: TenantContext, fn: () => void) => {
  tenantStorage.run(context, fn);
};

export const runWithTenantContextAsync = async <T>(
  context: TenantContext,
  fn: () => Promise<T>,
): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    runWithTenantContext(context, () => {
      Promise.resolve()
        .then(fn)
        .then(resolve)
        .catch(reject);
    });
  });

export const getTenantContext = (): TenantContext => tenantStorage.getStore() || {};

export const isTenantScopeGuardBypassed = (): boolean => Boolean(getTenantContext().scopeGuardBypass);

export const runWithTenantScopeGuardBypassAsync = async <T>(fn: () => Promise<T>): Promise<T> => {
  const current = getTenantContext();
  return runWithTenantContextAsync({ ...current, scopeGuardBypass: true }, fn);
};
