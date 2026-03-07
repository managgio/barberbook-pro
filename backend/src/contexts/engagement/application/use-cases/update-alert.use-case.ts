import { DomainError } from '../../../../shared/domain/domain-error';
import { AlertRepositoryPort } from '../../ports/outbound/alert-repository.port';
import { UpdateAlertCommand } from '../commands/update-alert.command';
import { parseAlertDateRangeOrThrow } from './alert-date-range';

export class UpdateAlertUseCase {
  constructor(private readonly alertRepositoryPort: AlertRepositoryPort) {}

  async execute(command: UpdateAlertCommand) {
    const existing = await this.alertRepositoryPort.findByIdAndLocalId({
      id: command.alertId,
      localId: command.context.localId,
    });
    if (!existing) {
      throw new DomainError('Alert not found', 'ALERT_NOT_FOUND');
    }

    const dateRange = parseAlertDateRangeOrThrow({
      startDate: command.startDate,
      endDate: command.endDate,
    });

    return this.alertRepositoryPort.updateById(command.alertId, {
      title: command.title,
      message: command.message,
      active: command.active,
      type: command.type,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
  }
}
