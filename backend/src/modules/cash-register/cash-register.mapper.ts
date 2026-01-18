import { CashMovement } from '@prisma/client';

export const mapCashMovement = (movement: CashMovement) => ({
  id: movement.id,
  localId: movement.localId,
  type: movement.type,
  amount: Number(movement.amount),
  method: movement.method || null,
  note: movement.note || null,
  occurredAt: movement.occurredAt.toISOString(),
  createdAt: movement.createdAt.toISOString(),
  updatedAt: movement.updatedAt.toISOString(),
});
