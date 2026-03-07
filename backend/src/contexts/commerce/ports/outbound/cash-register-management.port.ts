import {
  CommerceCashMovement,
  CommerceCashMovementProductOperationType,
  CommercePaymentMethod,
  CommerceCashMovementType,
} from '../../domain/entities/cash-movement.entity';

export const COMMERCE_CASH_REGISTER_MANAGEMENT_PORT = Symbol(
  'COMMERCE_CASH_REGISTER_MANAGEMENT_PORT',
);

export type CashMovementProductItemInput = {
  productId: string;
  quantity: number;
  unitAmount?: number;
};

export type CreateCashMovementInput = {
  localId: string;
  brandId: string;
  type: CommerceCashMovementType;
  amount: number;
  method?: CommercePaymentMethod | null;
  note?: string;
  occurredAt?: string;
  productOperationType?: CommerceCashMovementProductOperationType;
  productItems?: CashMovementProductItemInput[];
};

export type UpdateCashMovementInput = {
  localId: string;
  movementId: string;
  type?: CommerceCashMovementType;
  amount?: number;
  method?: CommercePaymentMethod | null;
  note?: string;
  occurredAt?: string;
};

export interface CommerceCashRegisterManagementPort {
  listByDate(params: { localId: string; date: string }): Promise<CommerceCashMovement[]>;
  create(input: CreateCashMovementInput): Promise<CommerceCashMovement>;
  update(input: UpdateCashMovementInput): Promise<CommerceCashMovement>;
  remove(params: { localId: string; movementId: string }): Promise<{ success: true }>;
}
