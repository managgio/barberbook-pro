import { RequestContext } from '../../../../shared/application/request-context';
import {
  CashMovementProductItemInput,
  CreateCashMovementInput,
} from '../../ports/outbound/cash-register-management.port';

export type CreateCashMovementCommand = {
  context: RequestContext;
  type: CreateCashMovementInput['type'];
  amount: number;
  method?: CreateCashMovementInput['method'];
  note?: string;
  occurredAt?: string;
  productOperationType?: CreateCashMovementInput['productOperationType'];
  productItems?: CashMovementProductItemInput[];
};
