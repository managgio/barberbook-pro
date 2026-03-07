import { CommerceCashRegisterManagementPort } from '../../ports/outbound/cash-register-management.port';
import { UpdateCashMovementCommand } from '../commands/update-cash-movement.command';

export class UpdateCashMovementUseCase {
  constructor(
    private readonly cashRegisterManagementPort: CommerceCashRegisterManagementPort,
  ) {}

  execute(command: UpdateCashMovementCommand) {
    return this.cashRegisterManagementPort.update({
      localId: command.context.localId,
      movementId: command.movementId,
      type: command.type,
      amount: command.amount,
      method: command.method,
      note: command.note,
      occurredAt: command.occurredAt,
    });
  }
}

