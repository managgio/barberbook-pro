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

@Injectable()
export class PrismaActiveLocationIteratorAdapter implements ActiveLocationIteratorPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_RUNNER_PORT)
    private readonly tenantContextRunnerPort: TenantContextRunnerPort,
  ) {}

  async forEachActiveLocation(
    callback: (context: { brandId: string; localId: string }) => Promise<void>,
  ): Promise<void> {
    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, brandId: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const location of locations) {
      await this.tenantContextRunnerPort.runWithContext(
        { brandId: location.brandId, localId: location.id },
        async () => {
          await callback({ brandId: location.brandId, localId: location.id });
        },
      );
    }
  }
}

export const ACTIVE_LOCATION_ITERATOR_PROVIDER = {
  provide: ACTIVE_LOCATION_ITERATOR_PORT,
  useClass: PrismaActiveLocationIteratorAdapter,
};
