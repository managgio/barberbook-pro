import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateServiceUseCase } from '../../contexts/commerce/application/use-cases/create-service.use-case';
import { GetServiceByIdUseCase } from '../../contexts/commerce/application/use-cases/get-service-by-id.use-case';
import { GetServicesUseCase } from '../../contexts/commerce/application/use-cases/get-services.use-case';
import { RemoveServiceUseCase } from '../../contexts/commerce/application/use-cases/remove-service.use-case';
import { UpdateServiceUseCase } from '../../contexts/commerce/application/use-cases/update-service.use-case';
import {
  COMMERCE_SERVICE_MANAGEMENT_PORT,
  CommerceServiceManagementPort,
} from '../../contexts/commerce/ports/outbound/service-management.port';
import {
  COMMERCE_SERVICE_READ_PORT,
  CommerceServiceReadPort,
} from '../../contexts/commerce/ports/outbound/service-read.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { mapService } from './services.mapper';

@Injectable()
export class ServicesService {
  private readonly getServicesUseCase: GetServicesUseCase;
  private readonly getServiceByIdUseCase: GetServiceByIdUseCase;
  private readonly createServiceUseCase: CreateServiceUseCase;
  private readonly updateServiceUseCase: UpdateServiceUseCase;
  private readonly removeServiceUseCase: RemoveServiceUseCase;

  constructor(
    @Inject(COMMERCE_SERVICE_READ_PORT)
    private readonly serviceReadPort: CommerceServiceReadPort,
    @Inject(COMMERCE_SERVICE_MANAGEMENT_PORT)
    private readonly serviceManagementPort: CommerceServiceManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.getServicesUseCase = new GetServicesUseCase(this.serviceReadPort);
    this.getServiceByIdUseCase = new GetServiceByIdUseCase(this.serviceReadPort);
    this.createServiceUseCase = new CreateServiceUseCase(this.serviceManagementPort, this.serviceReadPort);
    this.updateServiceUseCase = new UpdateServiceUseCase(this.serviceManagementPort, this.serviceReadPort);
    this.removeServiceUseCase = new RemoveServiceUseCase(this.serviceManagementPort);
  }

  async findAll(includeArchived = false) {
    const services = await this.getServicesUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      includeArchived,
    });
    return services.map((service) => mapService(service));
  }

  async findOne(id: string, includeArchived = false) {
    try {
      const service = await this.getServiceByIdUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        serviceId: id,
        includeArchived,
      });
      return mapService(service);
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        SERVICE_NOT_FOUND: () => new NotFoundException('Service not found'),
      });
      throw error;
    }
  }

  async create(data: CreateServiceDto) {
    try {
      const created = await this.createServiceUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        name: data.name,
        description: data.description,
        price: data.price,
        duration: data.duration,
        categoryId: data.categoryId,
      });
      return mapService(created);
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        SERVICE_NOT_FOUND: () => new NotFoundException('Service not found'),
        CATEGORY_NOT_FOUND: () => new NotFoundException('Category not found'),
        SERVICE_CATEGORY_REQUIRED_WHEN_ENABLED: () =>
          new BadRequestException('Debes asignar una categoría porque la categorización está activada.'),
      });
      throw error;
    }
  }

  async update(id: string, data: UpdateServiceDto) {
    try {
      const updated = await this.updateServiceUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        serviceId: id,
        name: data.name,
        description: data.description,
        price: data.price,
        duration: data.duration,
        categoryId: data.categoryId,
      });
      return mapService(updated);
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        SERVICE_NOT_FOUND: () => new NotFoundException('Service not found'),
        CATEGORY_NOT_FOUND: () => new NotFoundException('Category not found'),
        SERVICE_CATEGORY_REQUIRED_WHEN_ENABLED: () =>
          new BadRequestException(
            'Todos los servicios deben tener categoría mientras la función esté activa.',
          ),
      });
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.removeServiceUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        serviceId: id,
      });
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        SERVICE_NOT_FOUND: () => new NotFoundException('Service not found'),
      });
      throw error;
    }
  }
}
