import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { BarbersService } from '@/modules/barbers/barbers.service';

const baseService = (overrides?: {
  isAllowed?: boolean;
  eligibleIds?: string[];
  businessType?: string;
}) => {
  const eligibilityCalls: Array<Record<string, unknown>> = [];
  const barberEligibilityReadPort = {
    getBarber: async () => null,
    getBarbers: async () => [],
    isBarberAllowedForService: async (params: { localId: string; barberId: string; serviceId: string }) => {
      eligibilityCalls.push({ type: 'isAllowed', ...params });
      return overrides?.isAllowed ?? true;
    },
    getEligibleBarberIdsForService: async (params: {
      localId: string;
      serviceId: string;
      barberIds: string[];
    }) => {
      eligibilityCalls.push({ type: 'eligibleIds', ...params });
      return overrides?.eligibleIds ?? params.barberIds;
    },
  };

  const service = new BarbersService(
    {
      getEffectiveConfig: async () => ({ business: { type: overrides?.businessType ?? 'barbershop' } }),
    } as any,
    {} as any,
    {} as any,
    barberEligibilityReadPort as any,
    {} as any,
    {
      getRequestContext: () => ({ localId: 'loc-1', brandId: 'brand-1' }),
    } as any,
    {
      localizeCollection: async ({ items }: { items: any[] }) => ({ items }),
      syncEntitySourceFields: async () => {},
    } as any,
  );

  return { service, eligibilityCalls };
};

test('barbers facade delegates service compatibility check to eligibility port', async () => {
  const { service, eligibilityCalls } = baseService({ isAllowed: true });

  const allowed = await service.isBarberAllowedForService('barber-1', 'service-1');

  assert.equal(allowed, true);
  assert.equal(eligibilityCalls.length, 1);
  assert.equal(eligibilityCalls[0].type, 'isAllowed');
  assert.equal(eligibilityCalls[0].localId, 'loc-1');
});

test('barbers facade delegates eligible ids resolution to eligibility port', async () => {
  const { service, eligibilityCalls } = baseService({ eligibleIds: ['barber-2'] });

  const ids = await service.getEligibleBarberIdsForService('service-1', ['barber-1', 'barber-2']);

  assert.deepEqual(ids, ['barber-2']);
  assert.equal(eligibilityCalls.length, 1);
  assert.equal(eligibilityCalls[0].type, 'eligibleIds');
});

test('assertBarberCanProvideService throws when eligibility port returns false', async () => {
  const { service } = baseService({ isAllowed: false, businessType: 'barbershop' });

  await assert.rejects(
    () => service.assertBarberCanProvideService('barber-1', 'service-1'),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      return true;
    },
  );
});
