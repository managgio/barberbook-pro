import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommunicationChannel, CommunicationStatus } from '@prisma/client';
import { CommunicationsService } from '@/modules/communications/communications.service';
import { formatDateInTimeZone, formatTimeInTimeZone } from '@/utils/timezone';

const buildService = (options?: {
  featureEnabled?: boolean;
  campaignStatus?: CommunicationStatus;
}) => {
  const createdCampaign = {
    id: 'campaign-1',
    brandId: 'brand-1',
    localId: 'local-1',
    createdByUserId: 'admin-1',
    originCampaignId: null,
    actionType: 'solo_comunicar',
    scopeType: 'all_day',
    channel: 'sms',
    templateKey: 'general_announcement',
    status: options?.campaignStatus || CommunicationStatus.draft,
    title: 'Title',
    subject: 'Subject',
    message: 'Message',
    internalNote: null,
    scopeConfig: {},
    options: {},
    impactSummary: {},
    resultSummary: null,
    scheduledFor: null,
    executedAt: null,
    cancelledAt: null,
    holidayGeneralId: null,
    holidayBarberId: null,
    createdAt: new Date('2026-04-09T10:00:00.000Z'),
    updatedAt: new Date('2026-04-09T10:00:00.000Z'),
    createdByUser: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
    executions: [],
  };
  const calls: {
    createdStatus?: CommunicationStatus;
    preferredChannel?: CommunicationChannel;
    createdData?: Record<string, unknown>;
  } = {};

  const prisma = {
    communicationCampaign: {
      create: async ({ data }: { data: { status: CommunicationStatus } & Record<string, unknown> }) => {
        calls.createdStatus = data.status;
        calls.createdData = data;
        return { ...createdCampaign, status: data.status };
      },
      findFirst: async () => createdCampaign,
      update: async () => createdCampaign,
    },
    communicationExecution: {
      findMany: async () => [],
    },
    communicationRecipientResult: {
      findMany: async () => [],
    },
    communicationChannelPreference: {
      upsert: async ({ create }: { create: { preferredChannel: CommunicationChannel } }) => {
        calls.preferredChannel = create.preferredChannel;
        return { preferredChannel: create.preferredChannel };
      },
    },
    location: {
      findUnique: async () => ({ name: 'Le Blond' }),
    },
  };

  const service = new CommunicationsService(
    prisma as any,
    {} as any,
    {} as any,
    { log: async () => undefined } as any,
    {
      getEffectiveConfig: async () => ({
        features: {
          communicationsEnabled: options?.featureEnabled !== false,
        },
      }),
    } as any,
    {
      getRequestContext: () => ({
        brandId: 'brand-1',
        localId: 'local-1',
      }),
    } as any,
    { runWithLock: async () => true } as any,
  );

  (service as any).computePreview = async () => ({
    publicPreview: {
      actionType: 'solo_comunicar',
      scopeType: 'all_day',
      channel: 'sms',
      scheduledFor: null,
      appointmentsAffected: 0,
      clientsAffected: 0,
      cancellations: 0,
      withoutValidContact: 0,
      excludedAlreadyNotified: 0,
      invalidRecipients: [],
      excludedRecipients: [],
      messagePreview: { title: 'Title', subject: 'Subject', body: 'Message' },
      createHoliday: null,
    },
    deliverableTargets: [],
    excludedTargets: [],
    cancellableAppointments: 0,
  });
  (service as any).logAudit = async () => undefined;
  (service as any).executeCampaignInternal = async () => ({ id: 'campaign-1', status: 'completed' });

  return { service, calls };
};

const buildServiceForScopeFiltering = (
  scheduleData?: Record<string, unknown>,
  appointments: Array<Record<string, unknown>> = [],
) => {
  const calls: { where?: unknown } = {};
  const prisma = {
    appointment: {
      findMany: async ({ where }: { where: unknown }) => {
        calls.where = where;
        return appointments;
      },
    },
    shopSchedule: {
      findUnique: async () => ({ data: scheduleData || {} }),
    },
  };

  const service = new CommunicationsService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  return { service, calls };
};

test('communications service blocks usage when tenant feature flag is disabled', async () => {
  const { service } = buildService({ featureEnabled: false });

  await assert.rejects(
    async () => {
      await service.preview({
        actionType: 'solo_comunicar',
        scopeType: 'all_day',
        scopeCriteria: { date: '2026-04-10' },
        templateKey: 'general_announcement',
        channel: 'email',
        title: 'x',
        message: 'x',
      } as any);
    },
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('communications service rejects scheduled cancellation campaigns', async () => {
  const { service } = buildService();

  await assert.rejects(
    async () => {
      await service.create(
        {
          actionType: 'comunicar_y_cancelar',
          scopeType: 'all_day',
          scopeCriteria: { date: '2026-04-10' },
          templateKey: 'local_closure',
          channel: 'email',
          title: 'Cierre',
          message: 'Mensaje',
          scheduleAt: '2026-04-10T10:00:00.000Z',
          executeNow: false,
        } as any,
        'admin-1',
      );
    },
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('holiday closure bypasses the optional communications flag and builds a ranged cancellation', async () => {
  const { service, calls } = buildService({ featureEnabled: false });

  const result = await service.createHolidayClosure(
    {
      type: 'barber',
      start: '2026-08-24',
      end: '2026-08-20',
      barberId: 'barber-1',
      idempotencyKey: 'holiday-action-1',
    },
    'admin-1',
  );

  assert.equal((result as any).status, 'completed');
  assert.equal(calls.createdStatus, CommunicationStatus.running);
  assert.equal(calls.createdData?.actionType, 'comunicar_y_cancelar');
  assert.equal(calls.createdData?.scopeType, 'professional_single');
  assert.deepEqual(calls.createdData?.scopeConfig, {
    dateFrom: '2026-08-20',
    dateTo: '2026-08-24',
    barberId: 'barber-1',
  });
  assert.deepEqual(calls.createdData?.options, {
    createHoliday: {
      enabled: true,
      type: 'barber',
      start: '2026-08-20',
      end: '2026-08-24',
      barberId: 'barber-1',
    },
  });
});

test('communications service rejects create payload without draft/schedule/execute mode', async () => {
  const { service } = buildService();

  await assert.rejects(
    async () => {
      await service.create(
        {
          actionType: 'solo_comunicar',
          scopeType: 'all_day',
          scopeCriteria: { date: '2026-04-10' },
          templateKey: 'general_announcement',
          channel: 'email',
          title: 'Aviso',
          message: 'Mensaje',
          executeNow: false,
        } as any,
        'admin-1',
      );
    },
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('communications service stores selected channel preference when saving a draft', async () => {
  const { service, calls } = buildService({
    campaignStatus: CommunicationStatus.draft,
  });

  const result = await service.create(
    {
      actionType: 'solo_comunicar',
      scopeType: 'all_day',
      scopeCriteria: { date: '2026-04-10' },
      templateKey: 'general_announcement',
      channel: 'sms',
      title: 'Aviso general',
      subject: 'Asunto',
      message: 'Mensaje',
      saveAsDraft: true,
    } as any,
    'admin-1',
  );

  assert.equal(calls.createdStatus, CommunicationStatus.draft);
  assert.equal(calls.preferredChannel, CommunicationChannel.sms);
  assert.equal((result as any).status, CommunicationStatus.draft);
});

test('communications service applies morning appointment scope using local morning shift', async () => {
  const { service, calls } = buildServiceForScopeFiltering({
    monday: {
      closed: false,
      morning: { enabled: true, start: '08:30', end: '13:45' },
      afternoon: { enabled: true, start: '15:00', end: '20:00' },
    },
  });

  await (service as any).fetchAppointmentsByScope(
    {
      scopeType: 'appointments_morning',
      scopeCriteria: { date: '2026-04-06' },
    },
    'local-1',
  );

  const where = calls.where as { startDateTime?: { gte?: Date; lt?: Date } };
  assert.ok(where.startDateTime?.gte instanceof Date);
  assert.ok(where.startDateTime?.lt instanceof Date);
  assert.equal(formatTimeInTimeZone(where.startDateTime!.gte!), '08:30');
  assert.equal(formatTimeInTimeZone(where.startDateTime!.lt!), '13:45');
});

test('communications service applies afternoon appointment scope using local afternoon shift', async () => {
  const { service, calls } = buildServiceForScopeFiltering({
    monday: {
      closed: false,
      morning: { enabled: true, start: '09:00', end: '14:00' },
      afternoon: { enabled: true, start: '16:00', end: '21:30' },
    },
  });

  await (service as any).fetchAppointmentsByScope(
    {
      scopeType: 'appointments_afternoon',
      scopeCriteria: { date: '2026-04-06' },
    },
    'local-1',
  );

  const where = calls.where as { startDateTime?: { gte?: Date; lt?: Date } };
  assert.ok(where.startDateTime?.gte instanceof Date);
  assert.ok(where.startDateTime?.lt instanceof Date);
  assert.equal(formatTimeInTimeZone(where.startDateTime!.gte!), '16:00');
  assert.equal(formatTimeInTimeZone(where.startDateTime!.lt!), '21:30');
});

test('communications service applies inclusive date ranges to holiday closures', async () => {
  const { service, calls } = buildServiceForScopeFiltering();

  await (service as any).fetchAppointmentsByScope(
    {
      scopeType: 'professional_single',
      scopeCriteria: {
        barberId: 'barber-1',
        dateFrom: '2026-08-20',
        dateTo: '2026-08-24',
      },
    },
    'local-1',
  );

  const where = calls.where as {
    barberId?: string;
    startDateTime?: { gte?: Date; lte?: Date };
  };
  assert.equal(where.barberId, 'barber-1');
  assert.equal(formatDateInTimeZone(where.startDateTime!.gte!), '2026-08-20');
  assert.equal(formatDateInTimeZone(where.startDateTime!.lte!), '2026-08-24');
  assert.equal(formatTimeInTimeZone(where.startDateTime!.lte!), '23:59');
});

test('communications service extracts guest email and phone from combined booking contact', () => {
  const { service } = buildServiceForScopeFiltering();

  const target = (service as any).mapAppointmentToTarget({
    id: 'appointment-1',
    userId: null,
    guestName: 'Invitada',
    guestContact: 'guest@example.test · +34 600 000 000',
    status: 'scheduled',
    startDateTime: new Date('2026-08-20T08:00:00.000Z'),
    user: null,
    service: { name: 'Servicio' },
    barber: { name: 'Profesional' },
  });

  assert.equal(target.email, 'guest@example.test');
  assert.equal(target.phone, '+34 600 000 000');
});

test('cancellation scope keeps every appointment when one client has multiple bookings', async () => {
  const appointmentBase = {
    userId: 'user-1',
    guestName: null,
    guestContact: null,
    status: 'scheduled',
    user: { id: 'user-1', name: 'Cliente', email: 'client@example.test', phone: null },
    service: { name: 'Servicio' },
    barber: { name: 'Profesional' },
  };
  const { service } = buildServiceForScopeFiltering(undefined, [
    {
      ...appointmentBase,
      id: 'appointment-1',
      startDateTime: new Date('2026-08-20T08:00:00.000Z'),
    },
    {
      ...appointmentBase,
      id: 'appointment-2',
      startDateTime: new Date('2026-08-21T08:00:00.000Z'),
    },
  ]);

  const result = await (service as any).resolveTargets(
    {
      actionType: 'comunicar_y_cancelar',
      scopeType: 'all_day',
      scopeCriteria: { dateFrom: '2026-08-20', dateTo: '2026-08-21' },
    },
    'local-1',
  );

  assert.equal(result.targets.length, 2);
  assert.equal(result.appointmentsAffected, 2);
  assert.equal(result.clientsAffected, 1);
});
