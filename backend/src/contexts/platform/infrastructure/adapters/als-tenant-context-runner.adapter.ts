import { Injectable } from '@nestjs/common';
import { runWithTenantContextAsync } from '../../../../tenancy/tenant.context';
import {
  TenantContextRunnerPort,
  TenantExecutionContext,
} from '../../ports/outbound/tenant-context-runner.port';
import { APP_TIMEZONE } from '../../../../utils/timezone';
import { resolveLocationTimeZone } from '../../domain/services/location-timezone.policy';

@Injectable()
export class AlsTenantContextRunnerAdapter implements TenantContextRunnerPort {
  runWithContext<T>(context: TenantExecutionContext, callback: () => Promise<T>): Promise<T> {
    return runWithTenantContextAsync(
      {
        brandId: context.brandId,
        localId: context.localId,
        timezone: resolveLocationTimeZone(context.timezone, APP_TIMEZONE),
        isPlatform: context.isPlatform,
        subdomain: context.subdomain ?? undefined,
      },
      callback,
    );
  }
}
