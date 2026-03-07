import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetAlertsUseCase } from '@/contexts/engagement/application/use-cases/get-alerts.use-case';
import { ManageReviewsUseCase } from '@/contexts/engagement/application/use-cases/manage-reviews.use-case';
import { AlertRepositoryPort } from '@/contexts/engagement/ports/outbound/alert-repository.port';
import { EngagementReviewManagementPort } from '@/contexts/engagement/ports/outbound/review-management.port';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-engagement-alerts-read-1',
};

test('get alerts use case routes to active or full listing based on query flag', async () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const alertRepository: AlertRepositoryPort = {
    listByLocalId: async (localId) => {
      calls.push({ type: 'listByLocalId', payload: localId });
      return [];
    },
    listActiveByLocalId: async (params) => {
      calls.push({ type: 'listActiveByLocalId', payload: params });
      return [];
    },
    create: async () => {
      throw new Error('unused');
    },
    findByIdAndLocalId: async () => null,
    updateById: async () => {
      throw new Error('unused');
    },
    deleteById: async () => undefined,
  };

  const useCase = new GetAlertsUseCase(alertRepository);
  const now = new Date('2026-04-01T10:30:00.000Z');

  await useCase.execute({
    context: requestContext,
    onlyActive: true,
    now,
  });
  await useCase.execute({
    context: requestContext,
    onlyActive: false,
  });

  assert.deepEqual(calls, [
    {
      type: 'listActiveByLocalId',
      payload: { localId: 'local-1', now },
    },
    {
      type: 'listByLocalId',
      payload: 'local-1',
    },
  ]);
});

test('manage reviews use case delegates all critical review operations to port', async () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const reviewPort: EngagementReviewManagementPort = {
    isModuleEnabled: async () => {
      calls.push({ type: 'isModuleEnabled', payload: null });
      return true;
    },
    getConfig: async () => {
      calls.push({ type: 'getConfig', payload: null });
      return {
        id: 'cfg-1',
        localId: 'local-1',
        enabled: true,
        googleReviewUrl: 'https://reviews.example',
        cooldownDays: 30,
        minVisitsToAsk: 2,
        showDelayMinutes: 60,
        maxSnoozes: 2,
        snoozeHours: 48,
        copyJson: {
          title: 'title',
          subtitle: 'subtitle',
          positiveText: 'positive',
          positiveCta: 'positive-cta',
          negativeText: 'negative',
          negativeCta: 'negative-cta',
          snoozeCta: 'later',
        },
      };
    },
    getConfigRaw: async () => {
      calls.push({ type: 'getConfigRaw', payload: null });
      return { source: 'raw' };
    },
    updateConfig: async (data) => {
      calls.push({ type: 'updateConfig', payload: data });
      return {
        id: 'cfg-1',
        localId: 'local-1',
        enabled: true,
        googleReviewUrl: data.googleReviewUrl ?? null,
        cooldownDays: 30,
        minVisitsToAsk: 2,
        showDelayMinutes: 60,
        maxSnoozes: 2,
        snoozeHours: 48,
        copyJson: {
          title: 'title',
          subtitle: 'subtitle',
          positiveText: 'positive',
          positiveCta: 'positive-cta',
          negativeText: 'negative',
          negativeCta: 'negative-cta',
          snoozeCta: 'later',
        },
      };
    },
    handleAppointmentCompleted: async (appointmentId) => {
      calls.push({ type: 'handleAppointmentCompleted', payload: appointmentId });
      return { appointmentId };
    },
    getPendingReview: async (actor) => {
      calls.push({ type: 'getPendingReview', payload: actor });
      return { id: 'review-1' };
    },
    markShown: async (id, actor) => {
      calls.push({ type: 'markShown', payload: { id, actor } });
      return { id };
    },
    rate: async (id, rating, actor) => {
      calls.push({ type: 'rate', payload: { id, rating, actor } });
      return { id, rating };
    },
    submitFeedback: async (id, text, actor) => {
      calls.push({ type: 'submitFeedback', payload: { id, text, actor } });
      return { id, text };
    },
    markClicked: async (id, actor) => {
      calls.push({ type: 'markClicked', payload: { id, actor } });
      return { id };
    },
    snooze: async (id, actor) => {
      calls.push({ type: 'snooze', payload: { id, actor } });
      return { id };
    },
    getMetrics: async (params) => {
      calls.push({ type: 'getMetrics', payload: params });
      return { total: 10 };
    },
    listFeedback: async (params) => {
      calls.push({ type: 'listFeedback', payload: params });
      return { total: 1, items: [] };
    },
    resolveFeedback: async (id) => {
      calls.push({ type: 'resolveFeedback', payload: id });
      return { id };
    },
  };

  const useCase = new ManageReviewsUseCase(reviewPort);
  const actor = { userId: 'user-99' };

  assert.equal(await useCase.isModuleEnabled(), true);
  assert.equal((await useCase.getConfig()).id, 'cfg-1');
  assert.deepEqual(await useCase.getConfigRaw(), { source: 'raw' });
  assert.equal((await useCase.updateConfig({ googleReviewUrl: 'https://new.example' })).googleReviewUrl, 'https://new.example');
  assert.deepEqual(await useCase.handleAppointmentCompleted('appt-1'), { appointmentId: 'appt-1' });
  assert.deepEqual(await useCase.getPendingReview(actor), { id: 'review-1' });
  assert.deepEqual(await useCase.markShown('review-1', actor), { id: 'review-1' });
  assert.deepEqual(await useCase.rate('review-1', 5, actor), { id: 'review-1', rating: 5 });
  assert.deepEqual(await useCase.submitFeedback('review-1', 'Buen servicio', actor), {
    id: 'review-1',
    text: 'Buen servicio',
  });
  assert.deepEqual(await useCase.markClicked('review-1', actor), { id: 'review-1' });
  assert.deepEqual(await useCase.snooze('review-1', actor), { id: 'review-1' });
  assert.deepEqual(await useCase.getMetrics({ from: new Date('2026-01-01'), to: new Date('2026-01-31') }), {
    total: 10,
  });
  assert.deepEqual(await useCase.listFeedback({ status: 'open', page: 1, pageSize: 25 }), {
    total: 1,
    items: [],
  });
  assert.deepEqual(await useCase.resolveFeedback('review-1'), { id: 'review-1' });

  assert.deepEqual(calls, [
    { type: 'isModuleEnabled', payload: null },
    { type: 'getConfig', payload: null },
    { type: 'getConfigRaw', payload: null },
    { type: 'updateConfig', payload: { googleReviewUrl: 'https://new.example' } },
    { type: 'handleAppointmentCompleted', payload: 'appt-1' },
    { type: 'getPendingReview', payload: actor },
    { type: 'markShown', payload: { id: 'review-1', actor } },
    { type: 'rate', payload: { id: 'review-1', rating: 5, actor } },
    { type: 'submitFeedback', payload: { id: 'review-1', text: 'Buen servicio', actor } },
    { type: 'markClicked', payload: { id: 'review-1', actor } },
    { type: 'snooze', payload: { id: 'review-1', actor } },
    {
      type: 'getMetrics',
      payload: { from: new Date('2026-01-01'), to: new Date('2026-01-31') },
    },
    { type: 'listFeedback', payload: { status: 'open', page: 1, pageSize: 25 } },
    { type: 'resolveFeedback', payload: 'review-1' },
  ]);
});
