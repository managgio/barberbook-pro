import { RequestContext } from '../../../../shared/application/request-context';

export const TENANT_CONTEXT_PORT = Symbol('TENANT_CONTEXT_PORT');

export interface TenantContextPort {
  getRequestContext(params?: { actorUserId?: string | null; correlationId?: string }): RequestContext;
}
