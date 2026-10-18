import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getLandingPublication, updateLandingPublication } from '@/data/api/landingPublication';
import LandingPublicationControl from './LandingPublicationControl';

vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: 'local-a' }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/data/api/landingPublication', () => ({ getLandingPublication: vi.fn(), updateLandingPublication: vi.fn() }));
const clients: QueryClient[] = [];
beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; });
const mount = (section: 'faq' | 'gallery') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><LandingPublicationControl section={section} /></QueryClientProvider>);
  return client;
};

it.each(['faq', 'gallery'] as const)('updates %s visibility using the displayed version and invalidates public content', async (section) => {
  vi.mocked(getLandingPublication).mockResolvedValue({ published: false, version: 4 });
  vi.mocked(updateLandingPublication).mockResolvedValue({ published: true, version: 5 });
  const client = mount(section); const invalidate = vi.spyOn(client, 'invalidateQueries');
  await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  await userEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(updateLandingPublication).toHaveBeenCalledWith(section, { published: true, version: 4 }));
  expect(screen.getByRole('switch')).toBeChecked();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: [section === 'faq' ? 'faqs' : 'gallery', 'local-a'] });
  expect(client.getQueryData(['landing-publication', 'local-a', section])).toEqual({ published: true, version: 5 });
});

it('does not claim publication succeeded when saving fails and refreshes the current state', async () => {
  vi.mocked(getLandingPublication).mockResolvedValue({ published: false, version: 2 });
  vi.mocked(updateLandingPublication).mockRejectedValue(new Error('conflict'));
  mount('gallery'); await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  await userEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(getLandingPublication).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('switch')).not.toBeChecked();
});
