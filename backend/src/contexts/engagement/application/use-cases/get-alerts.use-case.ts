import { AlertRepositoryPort } from '../../ports/outbound/alert-repository.port';
import { GetAlertsQuery } from '../queries/get-alerts.query';

export class GetAlertsUseCase {
  constructor(private readonly alertRepositoryPort: AlertRepositoryPort) {}

  execute(query: GetAlertsQuery) {
    if (query.onlyActive) {
      return this.alertRepositoryPort.listActiveByLocalId({
        localId: query.context.localId,
        now: query.now ?? new Date(),
      });
    }

    return this.alertRepositoryPort.listByLocalId(query.context.localId);
  }
}

