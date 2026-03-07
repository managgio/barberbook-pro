import { AlertRepositoryPort } from '../../ports/outbound/alert-repository.port';
import { CreateAlertCommand } from '../commands/create-alert.command';
import { parseAlertDateRangeOrThrow } from './alert-date-range';

export class CreateAlertUseCase {
  constructor(private readonly alertRepositoryPort: AlertRepositoryPort) {}

  execute(command: CreateAlertCommand) {
    const dateRange = parseAlertDateRangeOrThrow({
      startDate: command.startDate,
      endDate: command.endDate,
    });

    return this.alertRepositoryPort.create({
      localId: command.context.localId,
      title: command.title,
      message: command.message,
      active: command.active ?? true,
      type: command.type || 'info',
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
  }
}

