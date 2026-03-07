import { CommerceServiceReadPort } from '../../ports/outbound/service-read.port';
import { GetServicesQuery } from '../queries/get-services.query';

export class GetServicesUseCase {
  constructor(private readonly serviceReadPort: CommerceServiceReadPort) {}

  execute(query: GetServicesQuery) {
    return this.serviceReadPort.listServices({
      localId: query.context.localId,
      includeArchived: query.includeArchived,
    });
  }
}
