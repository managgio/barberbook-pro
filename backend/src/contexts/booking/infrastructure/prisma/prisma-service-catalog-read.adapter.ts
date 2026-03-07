import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ServiceCatalogReadPort } from '../../ports/outbound/service-read.port';

const DEFAULT_SERVICE_DURATION_MINUTES = 30;

@Injectable()
export class PrismaServiceCatalogReadAdapter implements ServiceCatalogReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async getServiceDuration(params: { localId: string; serviceId?: string }): Promise<number> {
    if (!params.serviceId) return DEFAULT_SERVICE_DURATION_MINUTES;

    const service = await this.prisma.service.findFirst({
      where: { id: params.serviceId, localId: params.localId },
      select: { duration: true },
    });

    return service?.duration ?? DEFAULT_SERVICE_DURATION_MINUTES;
  }
}
