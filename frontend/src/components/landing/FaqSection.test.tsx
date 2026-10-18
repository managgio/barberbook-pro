import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getFaqs } from '@/data/api/faqs';
import FaqSection from './FaqSection';

const state = vi.hoisted(() => ({ enabled: false, local: 'a', language: 'es' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: state.local, tenant: { config: { features: { faqEnabled: state.enabled } } } }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ language: state.language, t: (key: string) => key }) }));
vi.mock('@/data/api/faqs', () => ({ getFaqs: vi.fn() }));
const clients: QueryClient[] = [];
beforeEach(() => { state.enabled = false; state.local = 'a'; state.language = 'es'; vi.resetAllMocks(); });
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; });
const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return { client, ...render(<QueryClientProvider client={client}><FaqSection /></QueryClientProvider>) };
};

it('does not fetch or show a disabled FAQ section', () => {
  const { container } = mount(); expect(container).toBeEmptyDOMElement(); expect(getFaqs).not.toHaveBeenCalled();
});

it('hides an empty FAQ section', async () => {
  state.enabled = true; vi.mocked(getFaqs).mockResolvedValue([]); const { container } = mount();
  await waitFor(() => expect(getFaqs).toHaveBeenCalled()); expect(container).toBeEmptyDOMElement();
});

it('preserves order, renders safe text and uses a cache for each location and language', async () => {
  state.enabled = true; state.language = 'en';
  vi.mocked(getFaqs).mockResolvedValue([{ id: 'b', question: 'Second first?', answer: '<script>alert(1)</script>', position: 0, version: 1 }, { id: 'a', question: 'First last?', answer: 'Yes', position: 1, version: 1 }]);
  const { client } = mount(); await screen.findByText('Second first?');
  expect(screen.getAllByRole('button')[0]).toHaveTextContent('Second first?');
  await userEvent.click(screen.getByRole('button', { name: 'Second first?' }));
  expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  expect(client.getQueryData(['faqs', 'a', 'en'])).toHaveLength(2);
  expect(client.getQueryData(['faqs', 'a', 'es'])).toBeUndefined();
  expect(client.getQueryData(['faqs', 'b', 'en'])).toBeUndefined();
});
