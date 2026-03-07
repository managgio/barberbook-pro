export const TENANT_CONTEXT_RUNNER_PORT = Symbol('TENANT_CONTEXT_RUNNER_PORT');

export type TenantExecutionContext = {
  brandId: string;
  localId: string;
  subdomain?: string | null;
  isPlatform?: boolean;
};

export interface TenantContextRunnerPort {
  runWithContext<T>(context: TenantExecutionContext, callback: () => Promise<T>): Promise<T>;
}
