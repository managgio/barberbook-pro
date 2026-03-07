import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BarberDirectoryEntry } from '../../domain/entities/barber-directory.entity';
import { BarberDirectoryReadPort } from '../../ports/outbound/barber-directory-read.port';
import {
  BOOKING_BARBER_ASSIGNMENT_POLICY_READ_PORT,
  BarberAssignmentPolicyReadPort,
} from '../../ports/outbound/barber-assignment-policy-read.port';

type BarberWithAssignments = {
  id: string;
  localId: string;
  name: string;
  photo: string | null;
  photoFileId: string | null;
  specialty: string;
  role: string;
  bio: string | null;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  calendarColor: string | null;
  userId: string | null;
  serviceAssignments: Array<{ serviceId: string }>;
  serviceCategoryAssignments: Array<{ categoryId: string }>;
};

const mapBarberDirectoryEntry = (barber: BarberWithAssignments): BarberDirectoryEntry => ({
  id: barber.id,
  localId: barber.localId,
  name: barber.name,
  photo: barber.photo,
  photoFileId: barber.photoFileId,
  specialty: barber.specialty,
  role: barber.role,
  bio: barber.bio,
  startDate: barber.startDate,
  endDate: barber.endDate,
  isActive: barber.isActive,
  calendarColor: barber.calendarColor,
  userId: barber.userId,
  assignedServiceIds: barber.serviceAssignments.map((item) => item.serviceId),
  assignedCategoryIds: barber.serviceCategoryAssignments.map((item) => item.categoryId),
});

@Injectable()
export class PrismaBarberDirectoryReadAdapter implements BarberDirectoryReadPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BOOKING_BARBER_ASSIGNMENT_POLICY_READ_PORT)
    private readonly barberAssignmentPolicyReadPort: BarberAssignmentPolicyReadPort,
  ) {}

  private async getServiceEligibilityFilter(
    localId: string,
    serviceId: string,
  ): Promise<Prisma.BarberWhereInput | null> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId, isArchived: false },
      select: { id: true, categoryId: true },
    });
    if (!service) return null;

    const barberServiceAssignmentEnabled =
      await this.barberAssignmentPolicyReadPort.isBarberServiceAssignmentEnabled();
    if (!barberServiceAssignmentEnabled) return {};

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

  async listBarbers(params: {
    localId: string;
    serviceId?: string;
    includeInactive?: boolean;
  }): Promise<BarberDirectoryEntry[]> {
    const eligibilityFilter = params.serviceId
      ? await this.getServiceEligibilityFilter(params.localId, params.serviceId)
      : {};

    if (eligibilityFilter === null) return [];

    const barbers = await this.prisma.barber.findMany({
      where: {
        localId: params.localId,
        isArchived: false,
        ...eligibilityFilter,
        ...(params.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
      include: {
        serviceAssignments: { select: { serviceId: true } },
        serviceCategoryAssignments: { select: { categoryId: true } },
      },
    });

    return barbers.map((barber) => mapBarberDirectoryEntry(barber as BarberWithAssignments));
  }

  async getBarberById(params: {
    localId: string;
    barberId: string;
  }): Promise<BarberDirectoryEntry | null> {
    const barber = await this.prisma.barber.findFirst({
      where: {
        id: params.barberId,
        localId: params.localId,
        isArchived: false,
      },
      include: {
        serviceAssignments: { select: { serviceId: true } },
        serviceCategoryAssignments: { select: { categoryId: true } },
      },
    });

    return barber ? mapBarberDirectoryEntry(barber as BarberWithAssignments) : null;
  }
}
