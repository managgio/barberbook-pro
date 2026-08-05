import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock('@/data/api/request', () => ({
  apiRequest: apiRequestMock,
}));

import { reportCriticalTrace } from '@/lib/criticalTrace';

describe('criticalTrace', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('keeps successful booking milestones in memory without calling the API', async () => {
    await reportCriticalTrace({
      traceId: 'successful-trace',
      path: '/app/book',
      stage: 'service_selected',
      level: 'info',
      outcome: 'succeeded',
      occurredAt: 1_000,
    });

    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('persists one failed event enriched with the buffered booking trail', async () => {
    await reportCriticalTrace({
      traceId: 'failed-trace',
      path: '/app/book',
      stage: 'booking_flow',
      level: 'info',
      outcome: 'started',
      occurredAt: 1_000,
    });
    await reportCriticalTrace({
      traceId: 'failed-trace',
      path: '/app/book',
      serviceId: 'service-1',
      stage: 'service_selected',
      level: 'info',
      outcome: 'succeeded',
      occurredAt: 1_250,
    });
    await reportCriticalTrace({
      traceId: 'failed-trace',
      path: '/app/book',
      serviceId: 'service-1',
      stage: 'frontend_render',
      level: 'error',
      outcome: 'failed',
      message: 'Render failed',
      occurredAt: 1_500,
    });

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const request = apiRequestMock.mock.calls[0][1] as {
      body: { outcome: string; metadata: { breadcrumbCount: number; breadcrumbs: string; traceStartedAt: number } };
    };
    expect(request.body.outcome).toBe('failed');
    expect(request.body.metadata.breadcrumbCount).toBe(2);
    expect(request.body.metadata.traceStartedAt).toBe(1_000);
    expect(JSON.parse(request.body.metadata.breadcrumbs)).toEqual([
      expect.objectContaining({ stage: 'booking_flow', elapsedMs: 0 }),
      expect.objectContaining({ stage: 'service_selected', elapsedMs: 250, serviceId: 'service-1' }),
    ]);
  });
});
