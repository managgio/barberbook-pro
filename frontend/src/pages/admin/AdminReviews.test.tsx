import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminReviews from './AdminReviews';
import * as api from '@/data/api/reviews';
import type { ReviewProgramConfig, ReviewFeedbackItem } from '@/data/types';

const scope = vi.hoisted(() => ({ local: 'local-a' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: scope.local }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ language: 'es', t: (key: string) => key }) }));
vi.mock('@/lib/businessCopy', () => ({ useBusinessCopy: () => ({ location: { fromWithDefinite: 'del local', definiteSingular: 'el local' }, staff: { singular: 'Profesional' } }) }));
vi.mock('@/components/admin/InlineTranslationPopover', () => ({ default: () => null }));
vi.mock('@/data/api/reviews', () => ({ getReviewConfig: vi.fn(), updateReviewConfig: vi.fn(), getReviewMetrics: vi.fn(), getReviewFeedback: vi.fn(), resolveReviewFeedback: vi.fn() }));
const config: ReviewProgramConfig = {
  id: 'cfg-a', localId: 'local-a', enabled: true, googleReviewUrl: 'https://g.page/salon/review', cooldownDays: 60,
  minVisitsToAsk: 2, showDelayMinutes: 60, maxSnoozes: 1, snoozeHours: 48,
  copyJson: { title: 'Source title', subtitle: 'Subtitle', positiveText: 'Google', positiveCta: 'Google', negativeText: 'Feedback', negativeCta: 'Send', snoozeCta: 'Later' },
};
const item = (id: string): ReviewFeedbackItem => ({ id, privateFeedback: `Comment ${id}`, status: 'COMPLETED', feedbackStatus: 'OPEN', createdAt: '2026-10-18', appointmentId: 'appt', rating: 5 });
beforeEach(() => {
  vi.resetAllMocks(); scope.local = 'local-a';
  vi.mocked(api.getReviewConfig).mockResolvedValue(config);
  vi.mocked(api.getReviewMetrics).mockResolvedValue({ createdCount: 2, shownCount: 2, ratedCount: 2, googleClicksCount: 1, feedbackCount: 1, conversionRate: 0.5 });
  vi.mocked(api.getReviewFeedback).mockImplementation(async params => ({ total: 21, items: [item(params?.page === 2 ? 'second' : 'first')] }));
});
afterEach(cleanup);
const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}><AdminReviews /></QueryClientProvider>) };
};

it('allows feedback pagination and returns to page one when changing the filter', async () => {
  mount();
  await userEvent.click(await screen.findByRole('tab', { name: 'admin.reviews.tabs.feedback' }));
  await screen.findByText('Comment first');
  await userEvent.click(screen.getByRole('button', { name: 'admin.reviews.feedback.next' }));
  await screen.findByText('Comment second');
  expect(api.getReviewFeedback).toHaveBeenLastCalledWith({ status: 'OPEN', page: 2, pageSize: 20 });
  await userEvent.click(screen.getByRole('button', { name: 'admin.reviews.feedback.status.resolved' }));
  await waitFor(() => expect(api.getReviewFeedback).toHaveBeenLastCalledWith({ status: 'RESOLVED', page: 1, pageSize: 20 }));
});

it('removes resolved feedback from the open filter and refreshes its total', async () => {
  vi.mocked(api.getReviewFeedback).mockResolvedValue({ total: 1, items: [item('first')] });
  vi.mocked(api.resolveReviewFeedback).mockImplementation(async () => { vi.mocked(api.getReviewFeedback).mockResolvedValue({ total: 0, items: [] }); });
  mount();
  await userEvent.click(await screen.findByRole('tab', { name: 'admin.reviews.tabs.feedback' }));
  await userEvent.click(await screen.findByRole('button', { name: 'admin.reviews.actions.markResolved' }));
  await waitFor(() => expect(screen.queryByText('Comment first')).not.toBeInTheDocument());
  expect(screen.getByText('admin.reviews.feedback.empty')).toBeInTheDocument();
});

it('clears the configuration draft when changing local instead of showing the previous local', async () => {
  const view = mount();
  const title = await screen.findByDisplayValue('Source title');
  await userEvent.clear(title); await userEvent.type(title, 'Unsaved old local');
  scope.local = 'local-b';
  vi.mocked(api.getReviewConfig).mockResolvedValue({ ...config, localId: 'local-b', copyJson: { ...config.copyJson, title: 'Other local' } });
  view.rerender(<QueryClientProvider client={view.client}><AdminReviews /></QueryClientProvider>);
  await screen.findByDisplayValue('Other local');
  expect(screen.queryByDisplayValue('Unsaved old local')).not.toBeInTheDocument();
});
