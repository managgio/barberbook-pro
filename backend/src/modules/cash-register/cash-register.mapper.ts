import { Prisma } from '@prisma/client';

type CashMovementWithItems = Prisma.CashMovementGetPayload<{
  include: {
    productItems: {
      include: {
        product: {
          select: {
            name: true;
          };
        };
      };
    };
  };
}>;

export const mapCashMovement = (movement: CashMovementWithItems) => ({
  id: movement.id,
  localId: movement.localId,
  type: movement.type,
  amount: Number(movement.amount),
  method: movement.method || null,
  note: movement.note || null,
  productOperationType: movement.productOperationType || null,
  productItems: movement.productItems.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || item.productNameSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    quantity: item.quantity,
    unitAmount: Number(item.unitAmount),
    totalAmount: Number(item.unitAmount) * item.quantity,
  })),
  occurredAt: movement.occurredAt.toISOString(),
  createdAt: movement.createdAt.toISOString(),
  updatedAt: movement.updatedAt.toISOString(),
});
