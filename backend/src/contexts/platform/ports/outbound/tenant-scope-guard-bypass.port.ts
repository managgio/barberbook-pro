export const TENANT_SCOPE_GUARD_BYPASS_PORT = Symbol('TENANT_SCOPE_GUARD_BYPASS_PORT');

export interface TenantScopeGuardBypassPort {
  runWithScopeGuardBypass<T>(callback: () => Promise<T>): Promise<T>;
}
