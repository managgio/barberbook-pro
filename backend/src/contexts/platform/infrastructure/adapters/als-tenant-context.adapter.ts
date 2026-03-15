import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestContext } from '../../../../shared/application/request-context';
import { DEFAULT_BRAND_ID, DEFAULT_LOCAL_ID } from '../../../../tenancy/tenant.constants';
import { APP_TIMEZONE } from '../../../../utils/timezone';
import { getTenantContext } from '../../../../tenancy/tenant.context';
import { TenantContextPort } from '../../ports/outbound/tenant-context.port';

@Injectable()
export class AlsTenantContextAdapter implements TenantContextPort {
  getRequestContext(params?: { actorUserId?: string | null; correlationId?: string }): RequestContext {
    const currentContext = getTenantContext();
    const brandId = currentContext.brandId || DEFAULT_BRAND_ID;
    return {
      tenantId: brandId,
      brandId,
      localId: currentContext.localId || DEFAULT_LOCAL_ID,
      isPlatform: Boolean(currentContext.isPlatform),
      requestedLanguage: currentContext.requestedLanguage || null,
      actorUserId: params?.actorUserId ?? null,
      timezone: APP_TIMEZONE,
      correlationId: params?.correlationId || randomUUID(),
      subdomain: currentContext.subdomain || null,
    };
  }
}
