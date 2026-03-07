import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBarberUseCase } from '../../contexts/booking/application/use-cases/create-barber.use-case';
import { GetBarberByIdUseCase } from '../../contexts/booking/application/use-cases/get-barber-by-id.use-case';
import { ListBarbersUseCase } from '../../contexts/booking/application/use-cases/list-barbers.use-case';
import { RemoveBarberUseCase } from '../../contexts/booking/application/use-cases/remove-barber.use-case';
import { UpdateBarberServiceAssignmentUseCase } from '../../contexts/booking/application/use-cases/update-barber-service-assignment.use-case';
import { UpdateBarberUseCase } from '../../contexts/booking/application/use-cases/update-barber.use-case';
import {
  BARBER_ELIGIBILITY_READ_PORT,
  BarberEligibilityReadPort,
} from '../../contexts/booking/ports/outbound/barber-eligibility-read.port';
import {
  BOOKING_BARBER_DIRECTORY_READ_PORT,
  BarberDirectoryReadPort,
} from '../../contexts/booking/ports/outbound/barber-directory-read.port';
import {
  BOOKING_BARBER_MANAGEMENT_PORT,
  BarberManagementPort,
} from '../../contexts/booking/ports/outbound/barber-management.port';
import {
  BOOKING_BARBER_PHOTO_STORAGE_PORT,
  BarberPhotoStoragePort,
} from '../../contexts/booking/ports/outbound/barber-photo-storage.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { TENANT_CONFIG_READ_PORT, TenantConfigReadPort } from '../../shared/application/tenant-config-read.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { resolveStaffSingular } from '../../tenancy/business-copy';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { UpdateBarberServiceAssignmentDto } from './dto/update-barber-service-assignment.dto';
import { mapBarber } from './barbers.mapper';

type FindAllBarbersOptions = {
  includeInactive?: boolean;
};

@Injectable()
export class BarbersService {
  private readonly listBarbersUseCase: ListBarbersUseCase;
  private readonly getBarberByIdUseCase: GetBarberByIdUseCase;
  private readonly createBarberUseCase: CreateBarberUseCase;
  private readonly updateBarberUseCase: UpdateBarberUseCase;
  private readonly updateBarberServiceAssignmentUseCase: UpdateBarberServiceAssignmentUseCase;
  private readonly removeBarberUseCase: RemoveBarberUseCase;

  constructor(
    @Inject(TENANT_CONFIG_READ_PORT)
    private readonly tenantConfigReadPort: TenantConfigReadPort,
    @Inject(BOOKING_BARBER_DIRECTORY_READ_PORT)
    private readonly barberDirectoryReadPort: BarberDirectoryReadPort,
    @Inject(BOOKING_BARBER_MANAGEMENT_PORT)
    private readonly barberManagementPort: BarberManagementPort,
    @Inject(BARBER_ELIGIBILITY_READ_PORT)
    private readonly barberEligibilityReadPort: BarberEligibilityReadPort,
    @Inject(BOOKING_BARBER_PHOTO_STORAGE_PORT)
    private readonly barberPhotoStoragePort: BarberPhotoStoragePort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.listBarbersUseCase = new ListBarbersUseCase(this.barberDirectoryReadPort);
    this.getBarberByIdUseCase = new GetBarberByIdUseCase(this.barberDirectoryReadPort);
    this.createBarberUseCase = new CreateBarberUseCase(this.barberManagementPort);
    this.updateBarberUseCase = new UpdateBarberUseCase(this.barberManagementPort);
    this.updateBarberServiceAssignmentUseCase = new UpdateBarberServiceAssignmentUseCase(this.barberManagementPort);
    this.removeBarberUseCase = new RemoveBarberUseCase(
      this.barberManagementPort,
      this.barberPhotoStoragePort,
    );
  }

  async findAll(serviceId?: string, options?: FindAllBarbersOptions) {
    const barbers = await this.listBarbersUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      serviceId,
      includeInactive: options?.includeInactive === true,
    });
    return barbers.map(mapBarber);
  }

  async findOne(id: string) {
    try {
      const barber = await this.getBarberByIdUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        barberId: id,
      });
      return mapBarber(barber);
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        BARBER_NOT_FOUND: () => new NotFoundException('Barber not found'),
      });
      throw error;
    }
  }

  async isBarberAllowedForService(barberId: string, serviceId: string) {
    return this.barberEligibilityReadPort.isBarberAllowedForService({
      localId: this.getLocalId(),
      barberId,
      serviceId,
    });
  }

  async getEligibleBarberIdsForService(serviceId: string, barberIds: string[]) {
    return this.barberEligibilityReadPort.getEligibleBarberIdsForService({
      localId: this.getLocalId(),
      serviceId,
      barberIds,
    });
  }

  async assertBarberCanProvideService(barberId: string, serviceId: string) {
    const allowed = await this.isBarberAllowedForService(barberId, serviceId);
    if (!allowed) {
      const config = await this.tenantConfigReadPort.getEffectiveConfig();
      const staffSingular = resolveStaffSingular(config.business?.type);
      throw new BadRequestException(
        `El ${staffSingular} seleccionado no está disponible para este servicio.`,
      );
    }
  }

  async create(data: CreateBarberDto) {
    const created = await this.createBarberUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      name: data.name,
      photo: data.photo,
      photoFileId: data.photoFileId,
      specialty: data.specialty,
      role: data.role,
      bio: data.bio,
      startDate: data.startDate,
      endDate: data.endDate,
      isActive: data.isActive,
      calendarColor: data.calendarColor,
      userId: data.userId,
    });
    return mapBarber(created);
  }

  async update(id: string, data: UpdateBarberDto) {
    try {
      const updated = await this.updateBarberUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        barberId: id,
        name: data.name,
        photo: data.photo,
        photoFileId: data.photoFileId,
        specialty: data.specialty,
        role: data.role,
        bio: data.bio,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive,
        calendarColor: data.calendarColor,
        userId: data.userId,
      });
      return mapBarber(updated);
    } catch (error) {
      this.rethrowBarberErrors(error);
      throw error;
    }
  }

  async updateServiceAssignment(id: string, data: UpdateBarberServiceAssignmentDto) {
    try {
      const updated = await this.updateBarberServiceAssignmentUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        barberId: id,
        serviceIds: data.serviceIds,
        categoryIds: data.categoryIds,
      });
      return mapBarber(updated);
    } catch (error) {
      this.rethrowBarberErrors(error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.removeBarberUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        barberId: id,
      });
    } catch (error) {
      this.rethrowBarberErrors(error);
      throw error;
    }
  }

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private rethrowBarberErrors(error: unknown): never | void {
    rethrowDomainErrorAsHttp(error, {
      BARBER_NOT_FOUND: () => new NotFoundException('Barber not found'),
      BARBER_ASSIGNMENT_SERVICE_NOT_FOUND: () =>
        new BadRequestException(
          'Uno o varios servicios no existen, están archivados o no pertenecen a este local.',
        ),
      BARBER_ASSIGNMENT_CATEGORY_NOT_FOUND: () =>
        new BadRequestException(
          'Una o varias categorías no existen o no pertenecen a este local.',
        ),
    });
  }
}
