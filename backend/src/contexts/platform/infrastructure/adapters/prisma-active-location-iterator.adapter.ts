import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  ACTIVE_LOCATION_ITERATOR_PORT,
  ActiveLocationIteratorPort,
} from '../../ports/outbound/active-location-iterator.port';
import {
  TENANT_CONTEXT_RUNNER_PORT,
  TenantContextRunnerPort,
} from '../../ports/outbound/tenant-context-runner.port';
import { APP_TIMEZONE } from '../../../../utils/timezone';
import { resolveLocationTimeZone } from '../../domain/services/location-timezone.policy';

@Injectable()
export class PrismaActiveLocationIteratorAdapter implements ActiveLocationIteratorPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_RUNNER_PORT)
    private readonly tenantContextRunnerPort: TenantContextRunnerPort,
  ) {}

  async forEachActiveLocation(
    callback: (context: { brandId: string; localId: string; timezone: string }) => Promise<void>,
  ): Promise<void> {
    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, brandId: true, timezone: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const location of locations) {
      const timezone = resolveLocationTimeZone(location.timezone, APP_TIMEZONE);
      await this.tenantContextRunnerPort.runWithContext(
        { brandId: location.brandId, localId: location.id, timezone },
        async () => {
          await callback({ brandId: location.brandId, localId: location.id, timezone });
        },
      );
    }
  }
}

export const ACTIVE_LOCATION_ITERATOR_PROVIDER = {
  provide: ACTIVE_LOCATION_ITERATOR_PORT,
  useClass: PrismaActiveLocationIteratorAdapter,
};
