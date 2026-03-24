import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoyaltyScope } from '@prisma/client';
import { LoyaltyService } from '@/modules/loyalty/loyalty.service';
import { CommerceLoyaltyManagementPort } from '@/contexts/commerce/ports/outbound/loyalty-management.port';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-loyalty-test',
};

const tenantContextPort = {
  getRequestContext: () => requestContext,
};

const localizationService = {
  localizeCollection: async <T extends { id: string }>(params: { items: T[] }) => ({
    items: params.items,
    language: 'es',
  }),
  syncEntitySourceFields: async () => undefined,
};

const basePort = (): CommerceLoyaltyManagementPort => ({
  findAllAdmin: async () => [],
  findActive: async () => [],
  create: async () => ({
    id: 'lp-1',
    name: 'Loyalty',
    description: null,
    scope: 'global',
    requiredVisits: 5,
    maxCyclesPerClient: null,
    priority: 0,
    isActive: true,
    serviceId: null,
    serviceName: null,
    categoryId: null,
    categoryName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  update: async () => ({
    id: 'lp-1',
    name: 'Loyalty',
    description: null,
    scope: 'global',
    requiredVisits: 5,
    maxCyclesPerClient: null,
    priority: 0,
    isActive: true,
    serviceId: null,
    serviceName: null,
    categoryId: null,
    categoryName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  remove: async () => ({ success: true }),
  getSummary: async () => ({ enabled: false, programs: [] }),
  getPreview: async () => ({ enabled: false, program: null, progress: null, isFreeNext: false, nextIndex: null }),
  resolveRewardDecision: async () => null,
});

test('loyalty facade delegates program creation', async () => {
  const calls: Array<{ scope: string }> = [];
  const service = new LoyaltyService({
    ...basePort(),
    create: async (input) => {
      calls.push({ scope: input.scope });
      return {
        id: 'lp-2',
        name: input.name,
        description: input.description ?? null,
        scope: input.scope,
        requiredVisits: input.requiredVisits,
        maxCyclesPerClient: input.maxCyclesPerClient ?? null,
        priority: input.priority ?? 0,
        isActive: input.isActive ?? true,
        serviceId: input.serviceId ?? null,
        serviceName: null,
        categoryId: input.categoryId ?? null,
        categoryName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
  }, tenantContextPort as any, localizationService as any);

  const result = await service.create({
    name: 'VIP',
    scope: LoyaltyScope.global,
    requiredVisits: 5,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].scope, LoyaltyScope.global);
  assert.equal(result.id, 'lp-2');
});

test('loyalty facade delegates summary lookup', async () => {
  const calls: string[] = [];
  const service = new LoyaltyService({
    ...basePort(),
    getSummary: async (userId) => {
      calls.push(userId);
      return { enabled: true, programs: [] };
    },
  }, tenantContextPort as any, localizationService as any);

  const summary = await service.getSummary('user-1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'user-1');
  assert.equal(summary.enabled, true);
});
