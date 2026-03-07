import { CommerceCashRegisterManagementPort } from '../../ports/outbound/cash-register-management.port';
import { ListCashMovementsCommand } from '../commands/list-cash-movements.command';

export class ListCashMovementsUseCase {
  constructor(
    private readonly cashRegisterManagementPort: CommerceCashRegisterManagementPort,
  ) {}

  execute(command: ListCashMovementsCommand) {
    return this.cashRegisterManagementPort.listByDate({
      localId: command.context.localId,
      date: command.date,
    });
  }
}

