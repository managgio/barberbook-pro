import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ResolveLoyaltyRewardDecisionUseCase } from '@/contexts/commerce/application/use-cases/resolve-loyalty-reward-decision.use-case';

const buildReadPort = (overrides?: Partial<Record<string, unknown>>) =>
  ({
    isLoyaltyEnabled: async () => true,
    getUserRole: async () => 'client',
    getServiceCategory: async () => 'category-1',
    listActiveProgramsForService: async () => [
      {
        id: 'program-global',
        scope: 'global',
        requiredVisits: 5,
        maxCyclesPerClient: null,
        priority: 0,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: 'program-service',
        scope: 'service',
        requiredVisits: 4,
        maxCyclesPerClient: null,
        priority: 10,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      },
    ],
    countCompletedRewards: async () => 0,
    countCompletedVisits: async () => 3,
    countActiveVisits: async () => 3,
    ...overrides,
  }) as any;

test('returns null when user is missing or loyalty is disabled', async () => {
  const readPort = buildReadPort();
  const subscriptionPolicyPort = { hasUsableActiveSubscription: async () => false } as any;
  const useCase = new ResolveLoyaltyRewardDecisionUseCase(readPort, subscriptionPolicyPort);

  assert.equal(
    await useCase.execute({
      localId: 'local-1',
      userId: null,
      serviceId: 'service-1',
      referenceDate: new Date('2026-03-04T10:00:00.000Z'),
    }),
    null,
  );

  const disabledReadPort = buildReadPort({
    isLoyaltyEnabled: async () => false,
  });
  const disabledUseCase = new ResolveLoyaltyRewardDecisionUseCase(disabledReadPort, subscriptionPolicyPort);
  assert.equal(
    await disabledUseCase.execute({
      localId: 'local-1',
      userId: 'user-1',
      serviceId: 'service-1',
      referenceDate: new Date('2026-03-04T10:00:00.000Z'),
    }),
    null,
  );
});

test('returns null when subscription blocks loyalty', async () => {
  const readPort = buildReadPort();
  const subscriptionPolicyPort = {
    hasUsableActiveSubscription: async () => true,
  } as any;
  const useCase = new ResolveLoyaltyRewardDecisionUseCase(readPort, subscriptionPolicyPort);

  const result = await useCase.execute({
    localId: 'local-1',
    userId: 'user-1',
    serviceId: 'service-1',
    referenceDate: new Date('2026-03-04T10:00:00.000Z'),
  });
  assert.equal(result, null);
});

test('selects best eligible program and computes free-next flag', async () => {
  const readPort = buildReadPort();
  const subscriptionPolicyPort = {
    hasUsableActiveSubscription: async () => false,
  } as any;
  const useCase = new ResolveLoyaltyRewardDecisionUseCase(readPort, subscriptionPolicyPort);

  const result = await useCase.execute({
    localId: 'local-1',
    userId: 'user-1',
    serviceId: 'service-1',
    referenceDate: new Date('2026-03-04T10:00:00.000Z'),
  });

  assert.deepEqual(result, {
    programId: 'program-service',
    isFreeNext: true,
  });
});

test('filters programs that exceeded max cycles per client', async () => {
  const readPort = buildReadPort({
    listActiveProgramsForService: async () => [
      {
        id: 'program-limited',
        scope: 'service',
        requiredVisits: 4,
        maxCyclesPerClient: 1,
        priority: 10,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      },
      {
        id: 'program-fallback',
        scope: 'global',
        requiredVisits: 5,
        maxCyclesPerClient: null,
        priority: 0,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ],
    countCompletedRewards: async (params: { programId: string }) =>
      params.programId === 'program-limited' ? 1 : 0,
    countCompletedVisits: async () => 1,
    countActiveVisits: async () => 1,
  });
  const subscriptionPolicyPort = {
    hasUsableActiveSubscription: async () => false,
  } as any;
  const useCase = new ResolveLoyaltyRewardDecisionUseCase(readPort, subscriptionPolicyPort);

  const result = await useCase.execute({
    localId: 'local-1',
    userId: 'user-1',
    serviceId: 'service-1',
    referenceDate: new Date('2026-03-04T10:00:00.000Z'),
  });

  assert.deepEqual(result, {
    programId: 'program-fallback',
    isFreeNext: false,
  });
});
