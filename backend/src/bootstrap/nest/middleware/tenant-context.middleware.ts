import { Injectable } from '@nestjs/common';
import { TenantMiddleware } from '../../../tenancy/tenant.middleware';
import { TenantService } from '../../../tenancy/tenant.service';

@Injectable()
export class TenantContextMiddleware extends TenantMiddleware {
  constructor(tenantService: TenantService) {
    super(tenantService);
  }
}
