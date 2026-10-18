import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { getEntityTranslations } from '@/data/api/localization';
import InlineTranslationPopover from './InlineTranslationPopover';

const state = vi.hoisted(() => ({ localId: 'a' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: state.localId, tenant: { config: { i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] } } } }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/data/api/localization', () => ({ getEntityTranslations: vi.fn(), upsertManualTranslation: vi.fn(), queueLocalizationRegeneration: vi.fn() }));
afterEach(cleanup);

it('keeps inline translation caches isolated when switching locations', async () => {
  vi.mocked(getEntityTranslations).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const content = () => <QueryClientProvider client={client}><InlineTranslationPopover entityType="faq" entityId="same-id" fieldKey="question" /></QueryClientProvider>;
  state.localId = 'a'; const view = render(content());
  await userEvent.click(screen.getByRole('button', { name: 'admin.localization.actions.openManager' }));
  await waitFor(() => expect(client.getQueryData(['inline-localization', 'a', 'faq', 'same-id'])).toEqual([]));
  state.localId = 'b'; view.rerender(content());
  await waitFor(() => expect(client.getQueryData(['inline-localization', 'b', 'faq', 'same-id'])).toEqual([]));
  expect(getEntityTranslations).toHaveBeenCalledTimes(2);
  client.clear();
});
