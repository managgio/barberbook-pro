import { DomainError } from '../../../../shared/domain/domain-error';
import { BarberDirectoryReadPort } from '../../ports/outbound/barber-directory-read.port';
import { GetBarberByIdQuery } from '../queries/get-barber-by-id.query';

export class GetBarberByIdUseCase {
  constructor(private readonly barberDirectoryReadPort: BarberDirectoryReadPort) {}

  async execute(query: GetBarberByIdQuery) {
    const barber = await this.barberDirectoryReadPort.getBarberById({
      localId: query.context.localId,
      barberId: query.barberId,
    });

    if (!barber) {
      throw new DomainError('Barber not found', 'BARBER_NOT_FOUND');
    }

    return barber;
  }
}
