export type CommerceCashMovementType = 'in' | 'out';

export type CommerceCashMovementProductOperationType = 'sale' | 'purchase';

export type CommercePaymentMethod = 'cash' | 'card' | 'bizum' | 'stripe';

export type CommerceCashMovementProductItem = {
  id: string;
  productId: string | null;
  productName: string;
  productNameSnapshot: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
};

export type CommerceCashMovement = {
  id: string;
  localId: string;
  type: CommerceCashMovementType;
  amount: number;
  method: CommercePaymentMethod | null;
  note: string | null;
  productOperationType: CommerceCashMovementProductOperationType | null;
  productItems: CommerceCashMovementProductItem[];
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};
