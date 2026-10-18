import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ReviewPromptModal from './ReviewPromptModal';
import * as api from '@/data/api/reviews';
import type { ReviewPendingResponse } from '@/data/types';

const scope = vi.hoisted(() => ({ local: 'local-a', user: 'user-a', hidden: [] as string[], toast: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: scope.user } }) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: scope.local, tenant: { config: { adminSidebar: { hiddenSections: scope.hidden } } } }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ language: 'es', t: (key: string, params?: { rating: number }) => params ? `${key}-${params.rating}` : key }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: scope.toast }) }));
vi.mock('@/data/api/reviews', () => ({ getPendingReview: vi.fn(), markReviewShown: vi.fn(), rateReview: vi.fn(), sendReviewFeedback: vi.fn(), clickReview: vi.fn(), snoozeReview: vi.fn() }));
const pending: ReviewPendingResponse = {
  id: 'request-a', rating: null, status: 'ELIGIBLE', eligibleAt: '2026-10-18', snoozeCount: 0,
  googleReviewUrl: 'https://g.page/salon/review',
  copy: { title: 'Tu visita', subtitle: 'Tu opinión', positiveText: 'Comparte tu experiencia', positiveCta: 'Google', negativeText: 'Cuéntanos', negativeCta: 'Enviar', snoozeCta: 'Ahora no' },
};
const mount = (path = '/app/appointments') => render(<MemoryRouter initialEntries={[path]}><ReviewPromptModal /></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks(); scope.local = 'local-a'; scope.user = 'user-a'; scope.hidden = [];
  vi.mocked(api.getPendingReview).mockResolvedValue(pending);
  vi.mocked(api.markReviewShown).mockResolvedValue({});
  vi.mocked(api.rateReview).mockResolvedValue({ next: 'GOOGLE', googleReviewUrl: pending.googleReviewUrl });
});
afterEach(cleanup);

it.each([1, 2, 3, 4, 5])('offers both Google and private feedback after rating %s', async (rating) => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: `reviewPrompt.ratingLabel-${rating}` }));
  expect(await screen.findByRole('button', { name: 'Google' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'reviewPrompt.privateFeedback' })).toBeInTheDocument();
  expect(api.rateReview).toHaveBeenCalledWith('request-a', { rating });
  expect(api.getPendingReview).toHaveBeenCalledWith();
});

it('resumes the saved rating and validates private feedback before sending', async () => {
  vi.mocked(api.getPendingReview).mockResolvedValue({ ...pending, rating: 5, status: 'RATED' });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'reviewPrompt.privateFeedback' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  a  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  expect(api.sendReviewFeedback).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Buen servicio  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  await waitFor(() => expect(api.sendReviewFeedback).toHaveBeenCalledWith('request-a', { text: 'Buen servicio' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('allows dismissal after a failed snooze and prevents duplicate submissions', async () => {
  vi.mocked(api.snoozeReview).mockRejectedValue(new Error('offline'));
  mount();
  const close = await screen.findByRole('button', { name: 'Ahora no' });
  fireEvent.click(close); fireEvent.click(close);
  await waitFor(() => expect(scope.toast).toHaveBeenCalled());
  expect(api.snoozeReview).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('discards a late response from a previous local', async () => {
  let finish!: (value: ReviewPendingResponse) => void;
  vi.mocked(api.getPendingReview).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(null);
  const view = mount();
  scope.local = 'local-b';
  view.rerender(<MemoryRouter><ReviewPromptModal /></MemoryRouter>);
  await act(async () => finish(pending));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.markReviewShown).not.toHaveBeenCalled();
});

it('closes an old local draft and does not interrupt the booking flow', async () => {
  const view = mount();
  await screen.findByRole('dialog');
  scope.local = 'local-b'; vi.mocked(api.getPendingReview).mockResolvedValue(null);
  view.rerender(<MemoryRouter><ReviewPromptModal /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  cleanup(); vi.clearAllMocks();
  mount('/app/book');
  expect(api.getPendingReview).not.toHaveBeenCalled();
});

it('does not query reviews when Platform disables the module', () => {
  scope.hidden = ['reviews']; mount();
  expect(api.getPendingReview).not.toHaveBeenCalled();
});
