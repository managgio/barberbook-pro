import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { FindAppointmentByIdUseCase } from '@/contexts/booking/application/use-cases/find-appointment-by-id.use-case';
import { FindAppointmentsPageUseCase } from '@/contexts/booking/application/use-cases/find-appointments-page.use-case';
import { FindAppointmentsPageWithClientsUseCase } from '@/contexts/booking/application/use-cases/find-appointments-page-with-clients.use-case';
import { FindAppointmentsRangeWithClientsUseCase } from '@/contexts/booking/application/use-cases/find-appointments-range-with-clients.use-case';
import { BookingAppointmentQueryPort } from '@/contexts/booking/ports/outbound/booking-appointment-query.port';
import { BookingMaintenancePort } from '@/contexts/booking/ports/outbound/booking-maintenance.port';

test('find appointments page use case forwards localId and pagination to port', async () => {
  const calls: Array<{ localId: string; page: number; pageSize: number }> = [];
  const port: BookingAppointmentQueryPort = {
    findAppointmentsPage: async (params) => {
      calls.push({ localId: params.localId, page: params.page, pageSize: params.pageSize });
      return { total: 0, page: params.page, pageSize: params.pageSize, hasMore: false, items: [] };
    },
    findAppointmentsPageWithClients: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentsRangeWithClients: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentById: async () => {
      throw new Error('unused in this test');
    },
  };
  const useCase = new FindAppointmentsPageUseCase(port);

  const result = await useCase.execute({
    context: {
      tenantId: 't-1',
      brandId: 'b-1',
      localId: 'l-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-1',
    },
    filters: { barberId: 'barber-1', sort: 'asc' },
    page: 2,
    pageSize: 50,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { localId: 'l-1', page: 2, pageSize: 50 });
  assert.equal(result.page, 2);
});

test('find appointments page with clients use case forwards filters', async () => {
  const calls: Array<{ localId: string; dateFrom?: string; dateTo?: string }> = [];
  const port: BookingAppointmentQueryPort = {
    findAppointmentsPage: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentsPageWithClients: async (params) => {
      calls.push({ localId: params.localId, dateFrom: params.filters.dateFrom, dateTo: params.filters.dateTo });
      return {
        total: 0,
        page: params.page,
        pageSize: params.pageSize,
        hasMore: false,
        items: [],
        clients: [],
      };
    },
    findAppointmentsRangeWithClients: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentById: async () => {
      throw new Error('unused in this test');
    },
  };
  const useCase = new FindAppointmentsPageWithClientsUseCase(port);

  await useCase.execute({
    context: {
      tenantId: 't-1',
      brandId: 'b-1',
      localId: 'l-2',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-1',
    },
    filters: { dateFrom: '2026-03-01', dateTo: '2026-03-07', sort: 'desc' },
    page: 1,
    pageSize: 20,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { localId: 'l-2', dateFrom: '2026-03-01', dateTo: '2026-03-07' });
});

test('find appointments range with clients use case forwards local context', async () => {
  const calls: Array<{ localId: string; barberId?: string }> = [];
  const port: BookingAppointmentQueryPort = {
    findAppointmentsPage: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentsPageWithClients: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentsRangeWithClients: async (params) => {
      calls.push({ localId: params.localId, barberId: params.filters.barberId });
      return { items: [], clients: [] };
    },
    findAppointmentById: async () => {
      throw new Error('unused in this test');
    },
  };
  const useCase = new FindAppointmentsRangeWithClientsUseCase(port);

  await useCase.execute({
    context: {
      tenantId: 't-1',
      brandId: 'b-1',
      localId: 'l-3',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-1',
    },
    filters: { barberId: 'barber-7' },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { localId: 'l-3', barberId: 'barber-7' });
});

test('find appointment by id use case syncs statuses and reads by local scope', async () => {
  const queryCalls: Array<{ localId: string; appointmentId: string }> = [];
  const maintenanceCalls: string[][] = [];
  const queryPort: BookingAppointmentQueryPort = {
    findAppointmentsPage: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentsPageWithClients: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentsRangeWithClients: async () => {
      throw new Error('unused in this test');
    },
    findAppointmentById: async (params) => {
      queryCalls.push({ localId: params.localId, appointmentId: params.appointmentId });
      return { id: params.appointmentId };
    },
  };
  const maintenancePort: BookingMaintenancePort = {
    syncStatusesForAllAppointments: async () => 0,
    syncStatusesForAppointments: async (params) => {
      maintenanceCalls.push(params.appointmentIds);
      return 0;
    },
    sendPaymentConfirmation: async () => undefined,
    anonymizeAppointment: async () => ({ success: true }),
  };
  const useCase = new FindAppointmentByIdUseCase(queryPort, maintenancePort);

  const result = await useCase.execute({
    context: {
      tenantId: 't-1',
      brandId: 'b-1',
      localId: 'l-9',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-1',
    },
    appointmentId: 'appt-123',
  });

  assert.deepEqual(maintenanceCalls, [['appt-123']]);
  assert.deepEqual(queryCalls, [{ localId: 'l-9', appointmentId: 'appt-123' }]);
  assert.deepEqual(result, { id: 'appt-123' });
});
