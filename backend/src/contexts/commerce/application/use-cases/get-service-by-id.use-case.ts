import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceServiceReadPort } from '../../ports/outbound/service-read.port';
import { GetServiceByIdQuery } from '../queries/get-service-by-id.query';

export class GetServiceByIdUseCase {
  constructor(private readonly serviceReadPort: CommerceServiceReadPort) {}

  async execute(query: GetServiceByIdQuery) {
    const service = await this.serviceReadPort.getServiceById({
      localId: query.context.localId,
      serviceId: query.serviceId,
      includeArchived: query.includeArchived,
    });

    if (!service) {
      throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
    }

    return service;
  }
}
