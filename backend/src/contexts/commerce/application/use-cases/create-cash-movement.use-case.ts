import { CommerceCashRegisterManagementPort } from '../../ports/outbound/cash-register-management.port';
import { CreateCashMovementCommand } from '../commands/create-cash-movement.command';

export class CreateCashMovementUseCase {
  constructor(
    private readonly cashRegisterManagementPort: CommerceCashRegisterManagementPort,
  ) {}

  execute(command: CreateCashMovementCommand) {
    return this.cashRegisterManagementPort.create({
      localId: command.context.localId,
      brandId: command.context.brandId,
      type: command.type,
      amount: command.amount,
      method: command.method,
      note: command.note,
      occurredAt: command.occurredAt,
      productOperationType: command.productOperationType,
      productItems: command.productItems,
    });
  }
}

