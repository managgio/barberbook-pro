import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AiToolsRegistry } from '../src/modules/ai-assistant/ai-tools.registry';
import { AI_TIME_ZONE } from '../src/modules/ai-assistant/ai-assistant.utils';

test('sanitizeUntrustedBarberSelection removes barber when it is actually the client mention', async () => {
  const registry = new AiToolsRegistry({} as any, {} as any, {} as any, {} as any);
  const args: Record<string, unknown> = {
    userName: 'Carlos López Monreal',
    barberName: 'Carlos López Monreal',
  };

  await (registry as any).sanitizeUntrustedBarberSelection(
    args,
    'crea una cita para Carlos López Monreal para mañana por la tarde para un corte clásico',
  );

  assert.equal(args.barberName, undefined);
});

test('sanitizeUntrustedBarberSelection keeps barber when explicitly requested with "con <nombre>"', async () => {
  const registry = new AiToolsRegistry({} as any, {} as any, {} as any, {} as any);
  const args: Record<string, unknown> = {
    userName: 'Carlos López Monreal',
    barberName: 'Juan Pérez',
  };

  await (registry as any).sanitizeUntrustedBarberSelection(
    args,
    'crea una cita para Carlos López Monreal mañana por la tarde con Juan Pérez para un corte clásico',
  );

  assert.equal(args.barberName, 'Juan Pérez');
});

test('sanitizeUntrustedBarberSelection removes hallucinated barberId when user did not request a barber', async () => {
  const prismaMock = {
    barber: {
      findFirst: async () => ({ name: 'Juan Pérez' }),
    },
  };
  const registry = new AiToolsRegistry(prismaMock as any, {} as any, {} as any, {} as any);
  const args: Record<string, unknown> = {
    userName: 'Carlos López Monreal',
    barberId: 'barber-123',
  };

  await (registry as any).sanitizeUntrustedBarberSelection(
    args,
    'crea una cita para Carlos López Monreal para mañana por la tarde para un corte clásico',
  );

  assert.equal(args.barberId, undefined);
});

test('extractImplicit entities from mixed sentence with repeated "para"', () => {
  const registry = new AiToolsRegistry({} as any, {} as any, {} as any, {} as any);
  const rawText =
    'crea una cita para carlos López Monreal para mañana por la tarde con Alejandro Ruiz para un corte clásico';

  assert.equal((registry as any).extractImplicitUserName(rawText), 'carlos López Monreal');
  assert.equal((registry as any).extractImplicitBarberName(rawText), 'Alejandro Ruiz');
  assert.equal((registry as any).extractImplicitServiceName(rawText), 'corte clásico');
});

test('extractImplicitServiceName still works for classic "con <servicio>" phrasing', () => {
  const registry = new AiToolsRegistry({} as any, {} as any, {} as any, {} as any);
  const rawText = 'crea una cita para carlos mañana a las 18:00 con corte clásico';
  assert.equal((registry as any).extractImplicitServiceName(rawText), 'corte clásico');
});

test('applyEntityInferenceFromRawText overwrites wrong serviceName with explicit service phrase', () => {
  const registry = new AiToolsRegistry({} as any, {} as any, {} as any, {} as any);
  const args: Record<string, unknown> = {
    serviceName: 'Alejandro Ruiz',
  };
  const rawText =
    'crea una cita para carlos López Monreal para mañana por la tarde con Alejandro Ruiz para un corte clásico';

  (registry as any).applyEntityInferenceFromRawText(args, rawText);

  assert.equal(args.userName, 'carlos López Monreal');
  assert.equal(args.barberName, 'Alejandro Ruiz');
  assert.equal(args.serviceName, 'corte clásico');
});

test('sanitizeUntrustedServiceSelection drops invalid serviceId and keeps inferred serviceName', async () => {
  const prismaMock = {
    service: {
      findFirst: async () => null,
    },
  };
  const registry = new AiToolsRegistry(prismaMock as any, {} as any, {} as any, {} as any);
  const args: Record<string, unknown> = {
    serviceId: 'fake-service-id',
    serviceName: 'Alejandro Ruiz',
  };
  const rawText =
    'crea una cita para carlos López Monreal para mañana por la tarde con Alejandro Ruiz para un corte clásico';

  await (registry as any).sanitizeUntrustedServiceSelection(args, rawText);

  assert.equal(args.serviceId, undefined);
  assert.equal(args.serviceName, 'corte clásico');
});

test('resolveService falls back to raw text when serviceId is invalid', async () => {
  const prismaMock = {
    service: {
      findFirst: async () => null,
      findMany: async () => [
        { id: 'service-1', name: 'Corte clásico', duration: 30 },
      ],
    },
  };
  const registry = new AiToolsRegistry(prismaMock as any, {} as any, {} as any, {} as any);
  const result = await (registry as any).resolveService({
    serviceId: 'invalid-service-id',
    rawText: 'corte clásico',
  });

  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.equal(result.service.id, 'service-1');
});

test('resolveBarberAndSlot prioritizes least loaded available barber when time is not explicit', async () => {
  const appointmentsServiceMock = {
    getWeeklyLoad: async () => ({
      counts: {
        'barber-a': 4,
        'barber-b': 1,
      },
    }),
    getAvailableSlotsBatch: async () => ({
      'barber-a': ['14:00'],
      'barber-b': ['16:00'],
    }),
  };
  const registry = new AiToolsRegistry({} as any, appointmentsServiceMock as any, {} as any, {} as any);
  const result = await (registry as any).resolveBarberAndSlot({
    context: {
      adminUserId: 'admin-1',
      now: new Date('2026-03-03T10:00:00Z'),
      timeZone: AI_TIME_ZONE,
    },
    barbers: [
      { id: 'barber-a', name: 'Alberto' },
      { id: 'barber-b', name: 'Bea' },
    ],
    serviceId: 'service-1',
    date: '2026-03-04',
    time: null,
    dayPeriod: 'afternoon',
    wantsSoonest: false,
  });

  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.equal(result.barber.id, 'barber-b');
  assert.equal(result.time, '16:00');
});

test('resolveUser asks for disambiguation when name overlaps multiple clients', async () => {
  const prismaMock = {
    user: {
      findMany: async () => [
        { id: 'user-1', name: 'Carlos López', email: 'carlos.lopez@example.com' },
        { id: 'user-2', name: 'Carlos López Monreal', email: 'carlos.monreal@example.com' },
      ],
    },
  };
  const registry = new AiToolsRegistry(prismaMock as any, {} as any, {} as any, {} as any);
  const result = await (registry as any).resolveUser({ userName: 'Carlos López Monreal' });

  assert.equal(result.status, 'needs_info');
  if (result.status !== 'needs_info') return;
  assert.equal(result.result.reason, 'user_ambiguous');
  assert.equal(result.result.options?.users?.length, 2);
});

test('resolveUser keeps a single clear match as registered client', async () => {
  const prismaMock = {
    user: {
      findMany: async () => [
        { id: 'user-2', name: 'Carlos López Monreal', email: 'carlos.monreal@example.com' },
      ],
    },
  };
  const registry = new AiToolsRegistry(prismaMock as any, {} as any, {} as any, {} as any);
  const result = await (registry as any).resolveUser({ userName: 'Carlos López Monreal' });

  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.equal(result.userId, 'user-2');
  assert.equal(result.clientName, 'Carlos López Monreal');
});
