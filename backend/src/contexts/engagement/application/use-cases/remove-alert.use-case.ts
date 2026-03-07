import { DomainError } from '../../../../shared/domain/domain-error';
import { AlertRepositoryPort } from '../../ports/outbound/alert-repository.port';
import { RemoveAlertCommand } from '../commands/remove-alert.command';

export class RemoveAlertUseCase {
  constructor(private readonly alertRepositoryPort: AlertRepositoryPort) {}

  async execute(command: RemoveAlertCommand) {
    const existing = await this.alertRepositoryPort.findByIdAndLocalId({
      id: command.alertId,
      localId: command.context.localId,
    });
    if (!existing) {
      throw new DomainError('Alert not found', 'ALERT_NOT_FOUND');
    }

    await this.alertRepositoryPort.deleteById(command.alertId);
  }
}

