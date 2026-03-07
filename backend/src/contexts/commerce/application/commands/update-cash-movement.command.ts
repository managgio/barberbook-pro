import { RequestContext } from '../../../../shared/application/request-context';
import { UpdateCashMovementInput } from '../../ports/outbound/cash-register-management.port';

export type UpdateCashMovementCommand = {
  context: RequestContext;
  movementId: string;
  type?: UpdateCashMovementInput['type'];
  amount?: number;
  method?: UpdateCashMovementInput['method'];
  note?: string;
  occurredAt?: string;
};
