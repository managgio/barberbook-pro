import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AdminSettings from './AdminSettings';

const state = vi.hoisted(() => ({ enabled: false, gallery: false, localId: 'local-a' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: state.localId, tenant: { config: { features: { faqEnabled: state.enabled, galleryEnabled: state.gallery } } } }) }));
vi.mock('@tanstack/react-query', async (original) => ({ ...await original<typeof import('@tanstack/react-query')>(), useQuery: () => ({ data: undefined, isLoading: false, error: null }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key, language: 'es' }) }));
vi.mock('@/lib/businessCopy', () => ({ useBusinessCopy: () => ({ staff: {}, location: {} }) }));
vi.mock('@/components/admin/InlineTranslationPopover', () => ({ default: () => null }));
vi.mock('@/components/admin/settings/faqs/FaqSettings', () => ({ default: () => <div data-testid="faq-settings">FAQ editor</div> }));
vi.mock('@/components/admin/settings/gallery/GallerySettings', () => ({ default: () => <div data-testid="gallery-settings">Gallery editor</div> }));
afterEach(() => { state.gallery = false; cleanup(); sessionStorage.clear(); });

it('hides disabled FAQs and falls back safely from a remembered FAQ tab', () => {
  state.enabled = false; sessionStorage.setItem('admin-settings-active-tab', 'faq');
  render(<AdminSettings />);
  expect(screen.queryByRole('tab', { name: 'admin.faq.title' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('faq-settings')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'admin.settings.tabs.identity' })).toHaveAttribute('data-state', 'active');
});

it('keeps website content out of general settings even when both capabilities are enabled', () => {
  state.enabled = true; state.gallery = true;
  sessionStorage.setItem('admin-settings-active-tab', 'gallery');
  render(<AdminSettings />);
  expect(screen.queryByRole('tab', { name: 'admin.faq.title' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'gallery.title' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('faq-settings')).not.toBeInTheDocument();
  expect(screen.queryByTestId('gallery-settings')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'admin.settings.tabs.identity' })).toHaveAttribute('data-state', 'active');
});
