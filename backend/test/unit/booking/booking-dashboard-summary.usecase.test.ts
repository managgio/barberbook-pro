import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ClockPort } from '@/shared/application/clock.port';
import { GetBookingDashboardSummaryUseCase } from '@/contexts/booking/application/use-cases/get-booking-dashboard-summary.use-case';
import { BookingDashboardReadPort } from '@/contexts/booking/ports/outbound/booking-dashboard-read.port';

const fixedNow = new Date('2026-03-05T10:00:00.000Z');

test('dashboard summary use case clamps window and forwards scoped query range', async () => {
  const readCalls: Array<{ localId: string; dateFrom: string; dateTo: string; barberId?: string }> = [];
  const readPort: BookingDashboardReadPort = {
    readDashboardSnapshot: async (params) => {
      readCalls.push(params);
      return {
        barbers: [{ id: 'barber-1', name: 'Ana' }],
        appointments: [],
      };
    },
  };
  const clock: ClockPort = {
    now: () => fixedNow,
  };
  const useCase = new GetBookingDashboardSummaryUseCase(readPort, clock);

  const result = await useCase.execute({
    context: {
      tenantId: 'tenant-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-1',
    },
    windowDays: 1,
    barberId: ' barber-1 ',
  });

  assert.deepEqual(readCalls, [
    {
      localId: 'local-1',
      dateFrom: '2026-02-04',
      dateTo: '2026-03-05',
      barberId: 'barber-1',
    },
  ]);
  assert.equal(result.windowDays, 7);
  assert.equal(result.generatedAt, fixedNow.toISOString());
  assert.equal(result.revenueDaily.length, 7);
  assert.equal(result.ticketDaily.length, 14);
});

test('dashboard summary use case computes today stats and weekly losses', async () => {
  const readPort: BookingDashboardReadPort = {
    readDashboardSnapshot: async () => ({
      barbers: [{ id: 'barber-1', name: 'Ana' }],
      appointments: [
        {
          id: 'a-completed-today',
          startDateTime: new Date('2026-03-05T10:00:00.000Z'),
          status: 'completed',
          price: 20,
          guestName: null,
          serviceNameSnapshot: null,
          barberNameSnapshot: null,
          userName: 'Cliente 1',
          serviceName: 'Corte',
          barberName: 'Ana',
        },
        {
          id: 'a-scheduled-today',
          startDateTime: new Date('2026-03-05T11:00:00.000Z'),
          status: 'scheduled',
          price: 15,
          guestName: 'Invitado',
          serviceNameSnapshot: 'Arreglo',
          barberNameSnapshot: 'Ana',
          userName: null,
          serviceName: null,
          barberName: null,
        },
        {
          id: 'a-cancelled-week',
          startDateTime: new Date('2026-03-02T12:00:00.000Z'),
          status: 'cancelled',
          price: 0,
          guestName: null,
          serviceNameSnapshot: 'Corte',
          barberNameSnapshot: 'Ana',
          userName: null,
          serviceName: null,
          barberName: null,
        },
        {
          id: 'a-no-show-week',
          startDateTime: new Date('2026-03-03T12:00:00.000Z'),
          status: 'no_show',
          price: 0,
          guestName: null,
          serviceNameSnapshot: 'Corte',
          barberNameSnapshot: 'Ana',
          userName: null,
          serviceName: null,
          barberName: null,
        },
      ],
    }),
  };
  const clock: ClockPort = {
    now: () => fixedNow,
  };
  const useCase = new GetBookingDashboardSummaryUseCase(readPort, clock);

  const result = await useCase.execute({
    context: {
      tenantId: 'tenant-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-2',
    },
    windowDays: 30,
  });

  assert.equal(result.stats.todayAppointments, 2);
  assert.equal(result.stats.revenueToday, 20);
  assert.equal(result.stats.weekCancelled, 1);
  assert.equal(result.stats.weekNoShow, 1);
  assert.equal(result.todayAppointments.length, 2);
  assert.equal(result.serviceMix[0]?.name, 'Corte');
  assert.equal(result.occupancy.max >= 1, true);
});
