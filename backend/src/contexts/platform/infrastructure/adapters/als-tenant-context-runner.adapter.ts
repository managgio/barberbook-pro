import { Injectable } from '@nestjs/common';
import { runWithTenantContextAsync } from '../../../../tenancy/tenant.context';
import {
  TenantContextRunnerPort,
  TenantExecutionContext,
} from '../../ports/outbound/tenant-context-runner.port';

@Injectable()
export class AlsTenantContextRunnerAdapter implements TenantContextRunnerPort {
  runWithContext<T>(context: TenantExecutionContext, callback: () => Promise<T>): Promise<T> {
    return runWithTenantContextAsync(
      {
        brandId: context.brandId,
        localId: context.localId,
        isPlatform: context.isPlatform,
        subdomain: context.subdomain ?? undefined,
      },
      callback,
    );
  }
}
