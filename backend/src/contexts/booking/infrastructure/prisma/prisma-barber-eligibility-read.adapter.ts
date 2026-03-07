import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  BarberEligibilityReadPort,
  BarberAvailabilitySnapshot,
} from '../../ports/outbound/barber-eligibility-read.port';

@Injectable()
export class PrismaBarberEligibilityReadAdapter implements BarberEligibilityReadPort {
  constructor(private readonly prisma: PrismaService) {}

  private async getServiceEligibilityFilter(
    localId: string,
    serviceId: string,
  ): Promise<Prisma.BarberWhereInput | null> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId, isArchived: false },
      select: { id: true, categoryId: true },
    });
    if (!service) return null;

    const settings = await this.prisma.siteSettings.findUnique({
      where: { localId },
      select: { data: true },
    });
    const settingsData = (settings?.data || {}) as { services?: { barberServiceAssignmentEnabled?: boolean } };
    const assignmentEnabled = settingsData.services?.barberServiceAssignmentEnabled === true;
    if (!assignmentEnabled) return {};

    const withNoAssignments: Prisma.BarberWhereInput = {
      AND: [{ serviceAssignments: { none: {} } }, { serviceCategoryAssignments: { none: {} } }],
    };

    return {
      OR: [
        withNoAssignments,
        { serviceAssignments: { some: { serviceId: service.id } } },
        ...(service.categoryId
          ? [{ serviceCategoryAssignments: { some: { categoryId: service.categoryId } } }]
          : []),
      ],
    };
  }

  async getBarber(params: { localId: string; barberId: string }): Promise<BarberAvailabilitySnapshot | null> {
    const barber = await this.prisma.barber.findFirst({
      where: { id: params.barberId, localId: params.localId },
      select: {
        id: true,
        isActive: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!barber) return null;

    return {
      id: barber.id,
      isActive: barber.isActive,
      startDate: barber.startDate,
      endDate: barber.endDate,
    };
  }

  async getBarbers(params: { localId: string; barberIds: string[] }): Promise<BarberAvailabilitySnapshot[]> {
    const barbers = await this.prisma.barber.findMany({
      where: {
        localId: params.localId,
        id: { in: params.barberIds },
      },
      select: {
        id: true,
        isActive: true,
        startDate: true,
        endDate: true,
      },
    });

    return barbers.map((barber) => ({
      id: barber.id,
      isActive: barber.isActive,
      startDate: barber.startDate,
      endDate: barber.endDate,
    }));
  }

  async isBarberAllowedForService(params: { localId: string; barberId: string; serviceId: string }): Promise<boolean> {
    const eligibilityFilter = await this.getServiceEligibilityFilter(params.localId, params.serviceId);
    if (eligibilityFilter === null) return false;

    const count = await this.prisma.barber.count({
      where: {
        id: params.barberId,
        localId: params.localId,
        isArchived: false,
        ...eligibilityFilter,
      },
    });

    return count > 0;
  }

  async getEligibleBarberIdsForService(params: {
    localId: string;
    serviceId: string;
    barberIds: string[];
  }): Promise<string[]> {
    const normalizedBarberIds = Array.from(new Set((params.barberIds || []).filter(Boolean)));
    if (normalizedBarberIds.length === 0) return [];

    const eligibilityFilter = await this.getServiceEligibilityFilter(params.localId, params.serviceId);
    if (eligibilityFilter === null) return [];

    const eligible = await this.prisma.barber.findMany({
      where: {
        id: { in: normalizedBarberIds },
        localId: params.localId,
        isArchived: false,
        ...eligibilityFilter,
      },
      select: { id: true },
    });

    return eligible.map((barber) => barber.id);
  }
}
