import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReviewAnalyticsService } from '@/modules/reviews/review-analytics.service';
import { ReviewConfigService } from '@/modules/reviews/review-config.service';
import { ReviewRequestService } from '@/modules/reviews/review-request.service';
import { EngagementReviewManagementPort } from '@/contexts/engagement/ports/outbound/review-management.port';

const basePort = (): EngagementReviewManagementPort => ({
  isModuleEnabled: async () => true,
  getConfig: async () => ({
    id: null,
    localId: 'local-1',
    enabled: false,
    googleReviewUrl: null,
    cooldownDays: 60,
    minVisitsToAsk: 2,
    showDelayMinutes: 60,
    maxSnoozes: 1,
    snoozeHours: 48,
    copyJson: {
      title: 't',
      subtitle: 's',
      positiveText: 'pt',
      positiveCta: 'pc',
      negativeText: 'nt',
      negativeCta: 'nc',
      snoozeCta: 'sc',
    },
  }),
  getConfigRaw: async () => null,
  updateConfig: async () => ({
    id: 'cfg-1',
    localId: 'local-1',
    enabled: true,
    googleReviewUrl: 'https://google.test',
    cooldownDays: 30,
    minVisitsToAsk: 1,
    showDelayMinutes: 10,
    maxSnoozes: 2,
    snoozeHours: 24,
    copyJson: {
      title: 'a',
      subtitle: 'b',
      positiveText: 'c',
      positiveCta: 'd',
      negativeText: 'e',
      negativeCta: 'f',
      snoozeCta: 'g',
    },
  }),
  handleAppointmentCompleted: async () => null,
  getPendingReview: async () => null,
  markShown: async () => null,
  rate: async () => ({ next: 'GOOGLE' }),
  submitFeedback: async () => null,
  markClicked: async () => null,
  snooze: async () => null,
  getMetrics: async () => ({ createdCount: 0 }),
  listFeedback: async () => ({ total: 0, items: [] }),
  resolveFeedback: async () => ({ id: 'rr-1' }),
});

test('review config facade delegates update config', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = new ReviewConfigService({
    ...basePort(),
    updateConfig: async (input) => {
      calls.push(input as Record<string, unknown>);
      return basePort().updateConfig(input);
    },
  });

  await service.updateConfig({
    enabled: true,
    googleReviewUrl: 'https://google.test/place',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].enabled, true);
});

test('review request facade delegates rate', async () => {
  const calls: Array<{ id: string; rating: number }> = [];
  const service = new ReviewRequestService({
    ...basePort(),
    rate: async (id, rating) => {
      calls.push({ id, rating });
      return { next: 'GOOGLE' };
    },
  });

  await service.rate('rr-1', 5, { userId: 'user-1' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'rr-1');
  assert.equal(calls[0].rating, 5);
});

test('review analytics facade delegates list feedback', async () => {
  const calls: Array<{ page: number; pageSize: number }> = [];
  const service = new ReviewAnalyticsService({
    ...basePort(),
    listFeedback: async (params) => {
      calls.push({ page: params.page, pageSize: params.pageSize });
      return { total: 0, items: [] };
    },
  });

  await service.listFeedback({ page: 2, pageSize: 25 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].page, 2);
  assert.equal(calls[0].pageSize, 25);
});
