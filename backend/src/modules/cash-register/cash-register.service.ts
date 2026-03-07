import { Inject, Injectable } from '@nestjs/common';
import { CreateCashMovementUseCase } from '../../contexts/commerce/application/use-cases/create-cash-movement.use-case';
import { ListCashMovementsUseCase } from '../../contexts/commerce/application/use-cases/list-cash-movements.use-case';
import { RemoveCashMovementUseCase } from '../../contexts/commerce/application/use-cases/remove-cash-movement.use-case';
import { UpdateCashMovementUseCase } from '../../contexts/commerce/application/use-cases/update-cash-movement.use-case';
import {
  COMMERCE_CASH_REGISTER_MANAGEMENT_PORT,
  CommerceCashRegisterManagementPort,
} from '../../contexts/commerce/ports/outbound/cash-register-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { UpdateCashMovementDto } from './dto/update-cash-movement.dto';

@Injectable()
export class CashRegisterService {
  private readonly listCashMovementsUseCase: ListCashMovementsUseCase;
  private readonly createCashMovementUseCase: CreateCashMovementUseCase;
  private readonly updateCashMovementUseCase: UpdateCashMovementUseCase;
  private readonly removeCashMovementUseCase: RemoveCashMovementUseCase;

  constructor(
    @Inject(COMMERCE_CASH_REGISTER_MANAGEMENT_PORT)
    private readonly cashRegisterManagementPort: CommerceCashRegisterManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.listCashMovementsUseCase = new ListCashMovementsUseCase(this.cashRegisterManagementPort);
    this.createCashMovementUseCase = new CreateCashMovementUseCase(this.cashRegisterManagementPort);
    this.updateCashMovementUseCase = new UpdateCashMovementUseCase(this.cashRegisterManagementPort);
    this.removeCashMovementUseCase = new RemoveCashMovementUseCase(this.cashRegisterManagementPort);
  }

  async listMovements(date: string) {
    return this.listCashMovementsUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      date,
    });
  }

  async createMovement(data: CreateCashMovementDto) {
    return this.createCashMovementUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      type: data.type,
      amount: data.amount,
      method: data.method,
      note: data.note,
      occurredAt: data.occurredAt,
      productOperationType: data.productOperationType,
      productItems: data.productItems?.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
      })),
    });
  }

  async updateMovement(id: string, data: UpdateCashMovementDto) {
    return this.updateCashMovementUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      movementId: id,
      type: data.type,
      amount: data.amount,
      method: data.method,
      note: data.note,
      occurredAt: data.occurredAt,
    });
  }

  async removeMovement(id: string) {
    return this.removeCashMovementUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      movementId: id,
    });
  }
}
