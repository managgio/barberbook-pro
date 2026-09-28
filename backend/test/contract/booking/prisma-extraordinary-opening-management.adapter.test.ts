import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { PrismaExtraordinaryOpeningManagementAdapter } from '@/contexts/booking/infrastructure/prisma/prisma-extraordinary-opening-management.adapter';
import { PrismaScheduleManagementAdapter } from '@/contexts/booking/infrastructure/prisma/prisma-schedule-management.adapter';
import {
  cloneSchedule,
  DEFAULT_SHOP_SCHEDULE,
} from '@/contexts/booking/infrastructure/prisma/support/schedule.policy';

const opening = {
  allProfessionals: false,
  barberIds: ['barber-local', 'barber-foreign'],
  morning: { enabled: true, start: '10:00', end: '14:00' },
  afternoon: { enabled: false, start: '00:00', end: '00:00' },
};

test('extraordinary opening write keeps only professionals from the scoped location', async () => {
  let barberFindManyArgs: any = null;
  let upsertArgs: any = null;
  const adapter = new PrismaExtraordinaryOpeningManagementAdapter({
    barber: {
      findMany: async (args: any) => {
        barberFindManyArgs = args;
        return [{ id: 'barber-local' }];
      },
    },
    shopSchedule: {
      findUnique: async () => ({ data: cloneSchedule(DEFAULT_SHOP_SCHEDULE) }),
      upsert: async (args: any) => {
        upsertArgs = args;
        return args.update;
      },
    },
  } as any);

  const result = await adapter.updateOpenings({
    localId: 'local-1',
    openings: { '2026-10-05': opening },
  });

  assert.equal(barberFindManyArgs.where.localId, 'local-1');
  assert.deepEqual(barberFindManyArgs.where.id, {
    in: ['barber-local', 'barber-foreign'],
  });
  assert.equal(upsertArgs.where.localId, 'local-1');
  assert.deepEqual(result.extraordinaryOpenings?.['2026-10-05'].barberIds, ['barber-local']);
});

test('extraordinary conflict read scopes holidays and closures to the current location', async () => {
  const calls: Array<{ model: string; args: any }> = [];
  const adapter = new PrismaExtraordinaryOpeningManagementAdapter({
    barber: {
      findMany: async (args: any) => {
        calls.push({ model: 'barber', args });
        return [{ id: 'barber-1' }];
      },
    },
    generalHoliday: {
      findFirst: async (args: any) => {
        calls.push({ model: 'generalHoliday', args });
        return { id: 1 };
      },
    },
    barberHoliday: {
      findMany: async (args: any) => {
        calls.push({ model: 'barberHoliday', args });
        return [{ barberId: 'barber-1' }];
      },
    },
    bookingClosure: {
      findMany: async (args: any) => {
        calls.push({ model: 'bookingClosure', args });
        return [{ barberId: null }, { barberId: 'barber-1' }];
      },
    },
  } as any);

  const result = await adapter.findConflicts({
    localId: 'local-1',
    dateOnly: '2026-10-05',
    timezone: 'Europe/Madrid',
    allProfessionals: false,
    barberIds: ['barber-1', 'barber-foreign'],
  });

  calls.forEach((call) => assert.equal(call.args.where.localId, 'local-1'));
  assert.deepEqual(calls.find((call) => call.model === 'barber')?.args.where.id, {
    in: ['barber-1', 'barber-foreign'],
  });
  assert.deepEqual(result, {
    generalHoliday: true,
    generalClosure: true,
    barberHolidayIds: ['barber-1'],
    barberClosureIds: ['barber-1'],
  });
});

test('regular schedule updates preserve extraordinary openings managed by their dedicated API', async () => {
  let upsertArgs: any = null;
  const storedSchedule = cloneSchedule(DEFAULT_SHOP_SCHEDULE);
  storedSchedule.extraordinaryOpenings = {
    '2026-10-05': { ...opening, barberIds: ['barber-local'] },
  };
  const adapter = new PrismaScheduleManagementAdapter({
    shopSchedule: {
      findUnique: async () => ({ data: storedSchedule }),
      upsert: async (args: any) => {
        upsertArgs = args;
        return args.update;
      },
    },
    siteSettings: {
      findUnique: async () => null,
    },
  } as any);

  const editedWeeklySchedule = cloneSchedule(DEFAULT_SHOP_SCHEDULE);
  editedWeeklySchedule.extraordinaryOpenings = {};
  editedWeeklySchedule.monday.morning.start = '11:00';
  const result = await adapter.updateShopSchedule({
    localId: 'local-1',
    schedule: editedWeeklySchedule,
  });

  assert.equal(upsertArgs.where.localId, 'local-1');
  assert.equal(result.monday.morning.start, '11:00');
  assert.deepEqual(result.extraordinaryOpenings, storedSchedule.extraordinaryOpenings);
});
