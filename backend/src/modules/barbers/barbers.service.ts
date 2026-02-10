import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStaffSingular } from '../../tenancy/business-copy';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { ImageKitService } from '../imagekit/imagekit.service';
import { SettingsService } from '../settings/settings.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { UpdateBarberServiceAssignmentDto } from './dto/update-barber-service-assignment.dto';
import { mapBarber } from './barbers.mapper';

const parseDate = (value?: string | null) => (value ? new Date(value) : null);
type FindAllBarbersOptions = {
  includeInactive?: boolean;
};

@Injectable()
export class BarbersService {
  private readonly logger = new Logger(BarbersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageKit: ImageKitService,
    private readonly settingsService: SettingsService,
    private readonly tenantConfigService: TenantConfigService,
  ) {}

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

  private async getServiceEligibilityFilter(
    localId: string,
    serviceId: string,
  ): Promise<Prisma.BarberWhereInput | null> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId, isArchived: false },
      select: { id: true, categoryId: true },
    });
    if (!service) return null;

    const settings = await this.settingsService.getSettings();
    const assignmentEnabled = settings.services.barberServiceAssignmentEnabled;
    if (!assignmentEnabled) return {};

    const withNoAssignments: Prisma.BarberWhereInput = {
      AND: [
        { serviceAssignments: { none: {} } },
        { serviceCategoryAssignments: { none: {} } },
      ],
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

  async findAll(serviceId?: string, options?: FindAllBarbersOptions) {
    const localId = getCurrentLocalId();
    const includeInactive = options?.includeInactive === true;
    const eligibilityFilter = serviceId
      ? await this.getServiceEligibilityFilter(localId, serviceId)
      : {};
    if (eligibilityFilter === null) return [];

    const where: Prisma.BarberWhereInput = {
      localId,
      isArchived: false,
      ...eligibilityFilter,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const barbers = await this.prisma.barber.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        serviceAssignments: { select: { serviceId: true } },
        serviceCategoryAssignments: { select: { categoryId: true } },
      },
    });
    return barbers.map(mapBarber);
  }

  async findOne(id: string) {
    const localId = getCurrentLocalId();
    const barber = await this.prisma.barber.findFirst({
      where: { id, localId, isArchived: false },
      include: {
        serviceAssignments: { select: { serviceId: true } },
        serviceCategoryAssignments: { select: { categoryId: true } },
      },
    });
    if (!barber) throw new NotFoundException('Barber not found');
    return mapBarber(barber);
  }

  async isBarberAllowedForService(barberId: string, serviceId: string) {
    const localId = getCurrentLocalId();
    const eligibilityFilter = await this.getServiceEligibilityFilter(localId, serviceId);
    if (eligibilityFilter === null) return false;

    const count = await this.prisma.barber.count({
      where: {
        id: barberId,
        localId,
        isArchived: false,
        ...eligibilityFilter,
      },
    });
    return count > 0;
  }

  async getEligibleBarberIdsForService(serviceId: string, barberIds: string[]) {
    const normalizedBarberIds = Array.from(new Set((barberIds || []).filter(Boolean)));
    if (normalizedBarberIds.length === 0) return [] as string[];

    const localId = getCurrentLocalId();
    const eligibilityFilter = await this.getServiceEligibilityFilter(localId, serviceId);
    if (eligibilityFilter === null) return [] as string[];

    const eligible = await this.prisma.barber.findMany({
      where: {
        id: { in: normalizedBarberIds },
        localId,
        isArchived: false,
        ...eligibilityFilter,
      },
      select: { id: true },
    });

    return eligible.map((barber) => barber.id);
  }

  async assertBarberCanProvideService(barberId: string, serviceId: string) {
    const allowed = await this.isBarberAllowedForService(barberId, serviceId);
    if (!allowed) {
      const config = await this.tenantConfigService.getEffectiveConfig();
      const staffSingular = resolveStaffSingular(config.business?.type);
      throw new BadRequestException(
        `El ${staffSingular} seleccionado no está disponible para este servicio.`,
      );
    }
  }

  async create(data: CreateBarberDto) {
    const localId = getCurrentLocalId();
    const created = await this.prisma.barber.create({
      data: {
        localId,
        name: data.name,
        photo: data.photo,
        photoFileId: data.photoFileId,
        specialty: data.specialty,
        role: data.role || 'worker',
        bio: data.bio,
        startDate: parseDate(data.startDate) || new Date(),
        endDate: parseDate(data.endDate),
        isActive: data.isActive ?? true,
        calendarColor: data.calendarColor,
        userId: data.userId,
      },
    });
    return mapBarber(created);
  }

  async update(id: string, data: UpdateBarberDto) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.barber.findFirst({
      where: { id, localId, isArchived: false },
    });
    if (!existing) throw new NotFoundException('Barber not found');

    const updated = await this.prisma.barber.update({
      where: { id },
      data: {
        name: data.name,
        photo: data.photo ?? undefined,
        photoFileId: data.photoFileId ?? undefined,
        specialty: data.specialty,
        role: data.role,
        bio: data.bio ?? undefined,
        startDate: data.startDate ? parseDate(data.startDate) || undefined : undefined,
        endDate: data.endDate === '' ? null : parseDate(data.endDate),
        isActive: data.isActive,
        calendarColor: data.calendarColor,
        userId: data.userId ?? undefined,
      },
    });
    return mapBarber(updated);
  }

  async updateServiceAssignment(id: string, data: UpdateBarberServiceAssignmentDto) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.barber.findFirst({
      where: { id, localId, isArchived: false },
      include: {
        serviceAssignments: { select: { serviceId: true } },
        serviceCategoryAssignments: { select: { categoryId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Barber not found');

    const serviceIds =
      data.serviceIds === undefined
        ? existing.serviceAssignments.map((item) => item.serviceId)
        : this.normalizeIds(data.serviceIds);
    const categoryIds =
      data.categoryIds === undefined
        ? existing.serviceCategoryAssignments.map((item) => item.categoryId)
        : this.normalizeIds(data.categoryIds);

    if (serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, localId, isArchived: false },
        select: { id: true },
      });
      if (services.length !== serviceIds.length) {
        throw new BadRequestException(
          'Uno o varios servicios no existen, están archivados o no pertenecen a este local.',
        );
      }
    }

    if (categoryIds.length > 0) {
      const categories = await this.prisma.serviceCategory.findMany({
        where: { id: { in: categoryIds }, localId },
        select: { id: true },
      });
      if (categories.length !== categoryIds.length) {
        throw new BadRequestException(
          'Una o varias categorías no existen o no pertenecen a este local.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.barberServiceAssignment.deleteMany({ where: { barberId: id } });
      await tx.barberServiceCategoryAssignment.deleteMany({ where: { barberId: id } });

      if (serviceIds.length > 0) {
        await tx.barberServiceAssignment.createMany({
          data: serviceIds.map((serviceId) => ({ barberId: id, serviceId })),
          skipDuplicates: true,
        });
      }
      if (categoryIds.length > 0) {
        await tx.barberServiceCategoryAssignment.createMany({
          data: categoryIds.map((categoryId) => ({ barberId: id, categoryId })),
          skipDuplicates: true,
        });
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.barber.findFirst({
      where: { id, localId, isArchived: false },
    });
    if (!existing) throw new NotFoundException('Barber not found');
    const appointmentCount = await this.prisma.appointment.count({
      where: { barberId: id, localId },
    });
    if (existing.photoFileId) {
      try {
        await this.imageKit.deleteFile(existing.photoFileId);
      } catch (error) {
        this.logger.warn(
          `No se pudo eliminar la foto del barbero ${id} en ImageKit: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    if (appointmentCount > 0) {
      await this.prisma.barber.update({
        where: { id },
        data: {
          isActive: false,
          isArchived: true,
          endDate: existing.endDate ?? new Date(),
          photo: null,
          photoFileId: null,
        },
      });
      return { success: true, archived: true };
    }

    await this.prisma.$transaction([
      this.prisma.barberServiceAssignment.deleteMany({ where: { barberId: id } }),
      this.prisma.barberServiceCategoryAssignment.deleteMany({ where: { barberId: id } }),
      this.prisma.barberHoliday.deleteMany({ where: { barberId: id, localId } }),
      this.prisma.barberSchedule.deleteMany({ where: { barberId: id, localId } }),
      this.prisma.barber.delete({ where: { id } }),
    ]);
    return { success: true };
  }
}
