import { CommerceCashRegisterManagementPort } from '../../ports/outbound/cash-register-management.port';
import { RemoveCashMovementCommand } from '../commands/remove-cash-movement.command';

export class RemoveCashMovementUseCase {
  constructor(
    private readonly cashRegisterManagementPort: CommerceCashRegisterManagementPort,
  ) {}

  execute(command: RemoveCashMovementCommand) {
    return this.cashRegisterManagementPort.remove({
      localId: command.context.localId,
      movementId: command.movementId,
    });
  }
}

