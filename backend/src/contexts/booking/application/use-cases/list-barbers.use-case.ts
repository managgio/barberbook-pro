import { BarberDirectoryReadPort } from '../../ports/outbound/barber-directory-read.port';
import { ListBarbersQuery } from '../queries/list-barbers.query';

export class ListBarbersUseCase {
  constructor(private readonly barberDirectoryReadPort: BarberDirectoryReadPort) {}

  execute(query: ListBarbersQuery) {
    return this.barberDirectoryReadPort.listBarbers({
      localId: query.context.localId,
      serviceId: query.serviceId,
      includeInactive: query.includeInactive,
    });
  }
}
