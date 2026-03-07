import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateCashMovementUseCase } from '@/contexts/commerce/application/use-cases/create-cash-movement.use-case';
import { ListCashMovementsUseCase } from '@/contexts/commerce/application/use-cases/list-cash-movements.use-case';
import { RemoveCashMovementUseCase } from '@/contexts/commerce/application/use-cases/remove-cash-movement.use-case';
import { UpdateCashMovementUseCase } from '@/contexts/commerce/application/use-cases/update-cash-movement.use-case';
import { CommerceCashMovement } from '@/contexts/commerce/domain/entities/cash-movement.entity';
import {
  CommerceCashRegisterManagementPort,
  CreateCashMovementInput,
  UpdateCashMovementInput,
} from '@/contexts/commerce/ports/outbound/cash-register-management.port';

const context = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-cash-register-1',
};

const sampleMovement: CommerceCashMovement = {
  id: 'movement-1',
  localId: context.localId,
  type: 'in' as const,
  amount: 12.5,
  method: 'cash',
  note: null,
  productOperationType: null,
  productItems: [],
  occurredAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const basePort = (): CommerceCashRegisterManagementPort => ({
  listByDate: async () => [sampleMovement],
  create: async () => sampleMovement,
  update: async () => sampleMovement,
  remove: async () => ({ success: true }),
});

test('list cash movements forwards local scope and date', async () => {
  const calls: Array<{ localId: string; date: string }> = [];
  const useCase = new ListCashMovementsUseCase({
    ...basePort(),
    listByDate: async (params: { localId: string; date: string }) => {
      calls.push(params);
      return [sampleMovement];
    },
  });

  const result = await useCase.execute({
    context,
    date: '2026-03-05',
  });

  const received = calls.at(0);
  assert.ok(received);
  assert.equal(received.localId, context.localId);
  assert.equal(received.date, '2026-03-05');
  assert.equal(result.length, 1);
});

test('create cash movement forwards local and brand scope', async () => {
  const calls: CreateCashMovementInput[] = [];
  const useCase = new CreateCashMovementUseCase({
    ...basePort(),
    create: async (input: CreateCashMovementInput) => {
      calls.push(input);
      return sampleMovement;
    },
  });

  await useCase.execute({
    context,
    type: 'in',
    amount: 25,
    method: 'card',
    productOperationType: 'sale',
    productItems: [{ productId: 'product-1', quantity: 2 }],
  });

  const received = calls.at(0);
  assert.ok(received);
  assert.equal(received.localId, context.localId);
  assert.equal(received.brandId, context.brandId);
  assert.equal(received.productOperationType, 'sale');
});

test('update cash movement forwards movement id and payload', async () => {
  const calls: UpdateCashMovementInput[] = [];
  const useCase = new UpdateCashMovementUseCase({
    ...basePort(),
    update: async (input: UpdateCashMovementInput) => {
      calls.push(input);
      return sampleMovement;
    },
  });

  await useCase.execute({
    context,
    movementId: 'movement-9',
    amount: 44,
    note: 'ajuste',
  });

  const received = calls.at(0);
  assert.ok(received);
  assert.equal(received.localId, context.localId);
  assert.equal(received.movementId, 'movement-9');
  assert.equal(received.amount, 44);
});

test('remove cash movement forwards movement id and local scope', async () => {
  const calls: Array<{ localId: string; movementId: string }> = [];
  const useCase = new RemoveCashMovementUseCase({
    ...basePort(),
    remove: async (params: { localId: string; movementId: string }) => {
      calls.push(params);
      return { success: true };
    },
  });

  const result = await useCase.execute({
    context,
    movementId: 'movement-22',
  });

  assert.deepEqual(result, { success: true });
  const received = calls.at(0);
  assert.ok(received);
  assert.equal(received.localId, context.localId);
  assert.equal(received.movementId, 'movement-22');
});
