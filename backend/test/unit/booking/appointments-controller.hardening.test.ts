import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { AppointmentsController } from '@/modules/appointments/appointments.controller';

const createAppointmentPayload = {
  barberId: 'barber-1',
  serviceId: 'service-1',
  startDateTime: '2026-03-25T09:00:00.000Z',
};

const buildController = (params?: {
  user?: {
    id: string;
    role: string;
    isSuperAdmin?: boolean;
    isPlatformAdmin?: boolean;
  } | null;
  isStaffMember?: boolean;
  appointmentOwnerUserId?: string | null;
}) => {
  const calls: {
    create?: { data: any; context: any };
    update?: { id: string; data: any; context: any };
    findPage?: any;
  } = {};

  const appointmentsFacade = {
    getAvailability: async () => [],
    getAvailabilityBatch: async () => ({}),
    getWeeklyLoad: async () => ({ counts: {} }),
    getDashboardSummary: async () => ({}),
    findPageWithClients: async () => ({}),
    findRangeWithClients: async () => ({ items: [], clients: [] }),
    findPage: async (payload: any) => {
      calls.findPage = payload;
      return payload;
    },
    findOne: async () => ({ id: 'appt-1', userId: params?.appointmentOwnerUserId ?? params?.user?.id ?? null }),
    create: async (data: any, context: any) => {
      calls.create = { data, context };
      return { id: 'appt-new' };
    },
    anonymize: async () => ({}),
    update: async (id: string, data: any, context: any) => {
      calls.update = { id, data, context };
      return { id };
    },
    remove: async () => ({ success: true }),
  };

  const authService = {
    resolveUserFromRequest: async () => params?.user ?? null,
  };

  const prisma = {
    locationStaff: {
      findUnique: async () => (params?.isStaffMember ? { userId: params.user?.id } : null),
    },
  };

  const tenantContextPort = {
    getRequestContext: () => ({ localId: 'local-1' }),
  };

  const controller = new AppointmentsController(
    appointmentsFacade as any,
    authService as any,
    prisma as any,
    tenantContextPort as any,
  );

  return { controller, calls };
};

test('findAll enforces self-or-admin filter for authenticated clients', async () => {
  const { controller } = buildController({
    user: { id: 'client-1', role: 'client' },
  });

  await assert.rejects(
    () =>
      controller.findAll(
        'client-2',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '1',
        '20',
        {},
      ),
    ForbiddenException,
  );
});

test('create rejects authenticated client bookings for another user', async () => {
  const { controller } = buildController({
    user: { id: 'client-1', role: 'client' },
  });

  await assert.rejects(
    () =>
      controller.create(
        { ...createAppointmentPayload, userId: 'another-user' } as any,
        { headers: {} } as any,
      ),
    ForbiddenException,
  );
});

test('create forces authenticated client bookings to self userId when omitted', async () => {
  const { controller, calls } = buildController({
    user: { id: 'client-1', role: 'client' },
  });

  await controller.create(
    { ...createAppointmentPayload } as any,
    { headers: {} } as any,
  );

  assert.equal(calls.create?.data.userId, 'client-1');
  assert.equal(calls.create?.context.actorUserId, null);
  assert.equal(calls.create?.context.requireConsent, true);
});

test('update rejects client attempts to set non-cancelled status', async () => {
  const { controller } = buildController({
    user: { id: 'client-1', role: 'client' },
    appointmentOwnerUserId: 'client-1',
  });

  await assert.rejects(
    () =>
      controller.update(
        'appt-1',
        { status: 'scheduled' } as any,
        { headers: {} } as any,
      ),
    ForbiddenException,
  );
});
