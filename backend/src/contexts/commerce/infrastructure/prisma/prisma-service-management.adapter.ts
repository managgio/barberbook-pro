import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  ArchiveCommerceServiceResult,
  CommerceServiceForManagement,
  CommerceServiceManagementPort,
  CreateCommerceServiceInput,
  UpdateCommerceServiceInput,
} from '../../ports/outbound/service-management.port';
import { areServiceCategoriesEnabled } from './support/commerce-settings.policy';

@Injectable()
export class PrismaServiceManagementAdapter implements CommerceServiceManagementPort {
  constructor(private readonly prisma: PrismaService) {}

  areCategoriesEnabled(localId: string): Promise<boolean> {
    return areServiceCategoriesEnabled(this.prisma, localId);
  }

  async categoryExists(params: { localId: string; categoryId: string }): Promise<boolean> {
    const category = await this.prisma.serviceCategory.findFirst({
      where: {
        id: params.categoryId,
        localId: params.localId,
      },
      select: { id: true },
    });

    return Boolean(category);
  }

  async findServiceForManagement(params: {
    localId: string;
    serviceId: string;
    includeArchived?: boolean;
  }): Promise<CommerceServiceForManagement | null> {
    const service = await this.prisma.service.findFirst({
      where: params.includeArchived
        ? {
            id: params.serviceId,
            localId: params.localId,
          }
        : {
            id: params.serviceId,
            localId: params.localId,
            isArchived: false,
          },
      select: {
        id: true,
        categoryId: true,
        position: true,
        isArchived: true,
      },
    });

    if (!service) {
      return null;
    }

    return {
      id: service.id,
      categoryId: service.categoryId,
      position: service.position,
      isArchived: service.isArchived,
    };
  }

  async getNextServicePosition(params: { localId: string; categoryId: string | null }): Promise<number> {
    const aggregate = await this.prisma.service.aggregate({
      where: {
        localId: params.localId,
        categoryId: params.categoryId,
      },
      _max: {
        position: true,
      },
    });

    return (aggregate._max.position ?? -1) + 1;
  }

  async createService(params: {
    localId: string;
    input: CreateCommerceServiceInput;
  }): Promise<{ id: string }> {
    const created = await this.prisma.service.create({
      data: {
        localId: params.localId,
        name: params.input.name,
        description: params.input.description,
        price: params.input.price,
        duration: params.input.duration,
        categoryId: params.input.categoryId,
        position: params.input.position,
      },
      select: { id: true },
    });

    return { id: created.id };
  }

  async updateService(params: {
    localId: string;
    serviceId: string;
    input: UpdateCommerceServiceInput;
  }): Promise<{ id: string } | null> {
    const existing = await this.prisma.service.findFirst({
      where: {
        id: params.serviceId,
        localId: params.localId,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }

    const updated = await this.prisma.service.update({
      where: { id: params.serviceId },
      data: {
        name: params.input.name,
        description: params.input.description,
        price: params.input.price,
        duration: params.input.duration,
        categoryId: params.input.categoryId,
        position: params.input.position,
      },
      select: { id: true },
    });

    return { id: updated.id };
  }

  async archiveService(params: { localId: string; serviceId: string }): Promise<ArchiveCommerceServiceResult> {
    const existing = await this.prisma.service.findFirst({
      where: {
        id: params.serviceId,
        localId: params.localId,
      },
      select: {
        id: true,
        isArchived: true,
      },
    });
    if (!existing) {
      return 'not_found';
    }

    if (existing.isArchived) {
      return 'already_archived';
    }

    await this.prisma.$transaction([
      this.prisma.service.update({
        where: { id: params.serviceId },
        data: { isArchived: true },
      }),
      this.prisma.barberServiceAssignment.deleteMany({
        where: { serviceId: params.serviceId },
      }),
    ]);

    return 'archived';
  }
}
