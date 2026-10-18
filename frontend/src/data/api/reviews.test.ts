import { expect, it, vi } from 'vitest';
import { apiRequest } from './request';
import { updateReviewConfig } from './reviews';
vi.mock('./request', () => ({ apiRequest: vi.fn() }));

it('saves only editable review settings, excluding server IDs rejected by the DTO', async () => {
  await updateReviewConfig({ id: 'config-id', localId: 'other-local', enabled: true, googleReviewUrl: 'https://g.page/salon/review', cooldownDays: 30 });
  const options = vi.mocked(apiRequest).mock.calls.at(-1)![1]!;
  expect(options.body).not.toHaveProperty('id');
  expect(options.body).not.toHaveProperty('localId');
  expect(options.body).toMatchObject({ enabled: true, cooldownDays: 30 });
});

it('partial updates do not clear the existing Google URL', async () => {
  await updateReviewConfig({ enabled: false });
  expect(JSON.parse(JSON.stringify(vi.mocked(apiRequest).mock.calls.at(-1)![1]!.body))).toEqual({ enabled: false });
});
