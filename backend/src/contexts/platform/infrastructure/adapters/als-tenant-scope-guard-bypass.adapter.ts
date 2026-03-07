import { Injectable } from '@nestjs/common';
import { runWithTenantScopeGuardBypassAsync } from '../../../../tenancy/tenant.context';
import { TenantScopeGuardBypassPort } from '../../ports/outbound/tenant-scope-guard-bypass.port';

@Injectable()
export class AlsTenantScopeGuardBypassAdapter implements TenantScopeGuardBypassPort {
  runWithScopeGuardBypass<T>(callback: () => Promise<T>): Promise<T> {
    return runWithTenantScopeGuardBypassAsync(callback);
  }
}
