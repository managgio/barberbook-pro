import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  isISODateOnly,
  normalizeExtraordinaryOpenings,
} from '@/contexts/booking/domain/value-objects/extraordinary-opening';
import { GetExtraordinaryOpeningConflictsUseCase } from '@/contexts/booking/application/use-cases/get-extraordinary-opening-conflicts.use-case';
import { UpdateExtraordinaryOpeningsUseCase } from '@/contexts/booking/application/use-cases/update-extraordinary-openings.use-case';
import { ExtraordinaryOpeningManagementPort } from '@/contexts/booking/ports/outbound/extraordinary-opening-management.port';

const context = {
  tenantId: 'brand-1',
  brandId: 'brand-1',
  localId: 'local-1',
  timezone: 'Europe/Madrid',
  actorUserId: 'admin-1',
  correlationId: 'correlation-1',
};

test('normalizes valid extraordinary openings and rejects invalid dates and shifts', () => {
  const normalized = normalizeExtraordinaryOpenings({
    '2026-10-05': {
      name: '  Apertura especial  ',
      allProfessionals: false,
      barberIds: ['barber-1', 'barber-1', ''],
      morning: { enabled: true, start: '10:00', end: '14:00' },
      afternoon: { enabled: false, start: '00:00', end: '00:00' },
    },
    '2026-02-30': {
      allProfessionals: true,
      barberIds: [],
      morning: { enabled: true, start: '10:00', end: '14:00' },
      afternoon: { enabled: false, start: '00:00', end: '00:00' },
    },
    '2026-10-06': {
      allProfessionals: true,
      barberIds: [],
      morning: { enabled: true, start: '14:00', end: '10:00' },
      afternoon: { enabled: false, start: '00:00', end: '00:00' },
    },
  });

  assert.deepEqual(Object.keys(normalized), ['2026-10-05']);
  assert.deepEqual(normalized['2026-10-05'], {
    name: 'Apertura especial',
    allProfessionals: false,
    barberIds: ['barber-1'],
    morning: { enabled: true, start: '10:00', end: '14:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  });
  assert.equal(isISODateOnly('2026-10-05'), true);
  assert.equal(isISODateOnly('2026-02-30'), false);
});

test('extraordinary opening use cases always forward the local from request context', async () => {
  const calls: unknown[] = [];
  const port: ExtraordinaryOpeningManagementPort = {
    updateOpenings: async (params) => {
      calls.push({ type: 'update', params });
      return { extraordinaryOpenings: params.openings } as any;
    },
    findConflicts: async (params) => {
      calls.push({ type: 'conflicts', params });
      return {
        generalHoliday: false,
        generalClosure: false,
        barberHolidayIds: [],
        barberClosureIds: [],
      };
    },
  };
  const updateUseCase = new UpdateExtraordinaryOpeningsUseCase(port);
  const conflictsUseCase = new GetExtraordinaryOpeningConflictsUseCase(port);
  const openings = normalizeExtraordinaryOpenings({
    '2026-10-05': {
      allProfessionals: true,
      barberIds: [],
      morning: { enabled: true, start: '10:00', end: '14:00' },
      afternoon: { enabled: false, start: '00:00', end: '00:00' },
    },
  });

  await updateUseCase.execute({ context, openings });
  await conflictsUseCase.execute({
    context,
    dateOnly: '2026-10-05',
    allProfessionals: false,
    barberIds: ['barber-1', 'barber-1'],
  });

  assert.deepEqual(calls, [
    {
      type: 'update',
      params: { localId: 'local-1', openings },
    },
    {
      type: 'conflicts',
      params: {
        localId: 'local-1',
        dateOnly: '2026-10-05',
        timezone: 'Europe/Madrid',
        allProfessionals: false,
        barberIds: ['barber-1'],
      },
    },
  ]);
});
