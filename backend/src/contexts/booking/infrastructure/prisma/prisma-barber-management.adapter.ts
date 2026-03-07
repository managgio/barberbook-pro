import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../../../shared/domain/domain-error';
import { BarberDirectoryEntry } from '../../domain/entities/barber-directory.entity';
import {
  BarberManagementPort,
  CreateBarberInput,
  RemoveBarberResult,
  UpdateBarberInput,
  UpdateBarberServiceAssignmentInput,
} from '../../ports/outbound/barber-management.port';
import { PrismaService } from '../../../../prisma/prisma.service';

const parseDate = (value?: string | null) => (value ? new Date(value) : null);

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
  serviceAssignments?: Array<{ serviceId: string }>;
  serviceCategoryAssignments?: Array<{ categoryId: string }>;
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
  assignedServiceIds: barber.serviceAssignments?.map((item) => item.serviceId) || [],
  assignedCategoryIds: barber.serviceCategoryAssignments?.map((item) => item.categoryId) || [],
});

@Injectable()
export class PrismaBarberManagementAdapter implements BarberManagementPort {
  constructor(private readonly prisma: PrismaService) {}

  async createBarber(params: {
    localId: string;
    input: CreateBarberInput;
  }): Promise<BarberDirectoryEntry> {
    const created = await this.prisma.barber.create({
      data: {
        localId: params.localId,
        name: params.input.name,
        photo: params.input.photo,
        photoFileId: params.input.photoFileId,
        specialty: params.input.specialty,
        role: (params.input.role as any) || 'worker',
        bio: params.input.bio,
        startDate: parseDate(params.input.startDate) || new Date(),
        endDate: parseDate(params.input.endDate),
        isActive: params.input.isActive ?? true,
        calendarColor: params.input.calendarColor,
        userId: params.input.userId,
      },
    });

    return mapBarberDirectoryEntry(created as BarberWithAssignments);
  }

  async updateBarber(params: {
    localId: string;
    barberId: string;
    input: UpdateBarberInput;
  }): Promise<BarberDirectoryEntry | null> {
    const existing = await this.prisma.barber.findFirst({
      where: { id: params.barberId, localId: params.localId, isArchived: false },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await this.prisma.barber.update({
      where: { id: params.barberId },
      data: {
        name: params.input.name,
        photo: params.input.photo ?? undefined,
        photoFileId: params.input.photoFileId ?? undefined,
        specialty: params.input.specialty,
        role: params.input.role as any,
        bio: params.input.bio ?? undefined,
        startDate: params.input.startDate ? parseDate(params.input.startDate) || undefined : undefined,
        endDate: params.input.endDate === '' ? null : parseDate(params.input.endDate),
        isActive: params.input.isActive,
        calendarColor: params.input.calendarColor,
        userId: params.input.userId ?? undefined,
      },
    });

    return mapBarberDirectoryEntry(updated as BarberWithAssignments);
  }

  async updateBarberServiceAssignment(params: {
    localId: string;
    barberId: string;
    input: UpdateBarberServiceAssignmentInput;
  }): Promise<BarberDirectoryEntry | null> {
    const existing = await this.prisma.barber.findFirst({
      where: { id: params.barberId, localId: params.localId, isArchived: false },
      include: {
        serviceAssignments: { select: { serviceId: true } },
        serviceCategoryAssignments: { select: { categoryId: true } },
      },
    });
    if (!existing) return null;

    const serviceIds =
      params.input.serviceIds === undefined
        ? existing.serviceAssignments.map((item) => item.serviceId)
        : this.normalizeIds(params.input.serviceIds);
    const categoryIds =
      params.input.categoryIds === undefined
        ? existing.serviceCategoryAssignments.map((item) => item.categoryId)
        : this.normalizeIds(params.input.categoryIds);

    if (serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, localId: params.localId, isArchived: false },
        select: { id: true },
      });
      if (services.length !== serviceIds.length) {
        throw new DomainError(
          'One or more services are invalid for this location.',
          'BARBER_ASSIGNMENT_SERVICE_NOT_FOUND',
        );
      }
    }

    if (categoryIds.length > 0) {
      const categories = await this.prisma.serviceCategory.findMany({
        where: { id: { in: categoryIds }, localId: params.localId },
        select: { id: true },
      });
      if (categories.length !== categoryIds.length) {
        throw new DomainError(
          'One or more categories are invalid for this location.',
          'BARBER_ASSIGNMENT_CATEGORY_NOT_FOUND',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.barberServiceAssignment.deleteMany({ where: { barberId: params.barberId } });
      await tx.barberServiceCategoryAssignment.deleteMany({ where: { barberId: params.barberId } });

      if (serviceIds.length > 0) {
        await tx.barberServiceAssignment.createMany({
          data: serviceIds.map((serviceId) => ({ barberId: params.barberId, serviceId })),
          skipDuplicates: true,
        });
      }
      if (categoryIds.length > 0) {
        await tx.barberServiceCategoryAssignment.createMany({
          data: categoryIds.map((categoryId) => ({ barberId: params.barberId, categoryId })),
          skipDuplicates: true,
        });
      }
    });

    const updated = await this.prisma.barber.findFirst({
      where: { id: params.barberId, localId: params.localId, isArchived: false },
      include: {
        serviceAssignments: { select: { serviceId: true } },
        serviceCategoryAssignments: { select: { categoryId: true } },
      },
    });
    if (!updated) return null;

    return mapBarberDirectoryEntry(updated as BarberWithAssignments);
  }

  async removeBarber(params: { localId: string; barberId: string }): Promise<RemoveBarberResult | null> {
    const existing = await this.prisma.barber.findFirst({
      where: { id: params.barberId, localId: params.localId, isArchived: false },
      select: { endDate: true, photoFileId: true },
    });
    if (!existing) return null;

    const appointmentCount = await this.prisma.appointment.count({
      where: { barberId: params.barberId, localId: params.localId },
    });

    if (appointmentCount > 0) {
      await this.prisma.barber.update({
        where: { id: params.barberId },
        data: {
          isActive: false,
          isArchived: true,
          endDate: existing.endDate ?? new Date(),
          photo: null,
          photoFileId: null,
        },
      });
      return {
        archived: true,
        photoFileId: existing.photoFileId,
      };
    }

    await this.prisma.$transaction([
      this.prisma.barberServiceAssignment.deleteMany({ where: { barberId: params.barberId } }),
      this.prisma.barberServiceCategoryAssignment.deleteMany({ where: { barberId: params.barberId } }),
      this.prisma.barberHoliday.deleteMany({ where: { barberId: params.barberId, localId: params.localId } }),
      this.prisma.barberSchedule.deleteMany({ where: { barberId: params.barberId, localId: params.localId } }),
      this.prisma.barber.delete({ where: { id: params.barberId } }),
    ]);

    return {
      archived: false,
      photoFileId: existing.photoFileId,
    };
  }

  private normalizeIds(values?: string[] | null) {
    if (!Array.isArray(values)) return [];
    return Array.from(
      new Set(
        values
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }
}
