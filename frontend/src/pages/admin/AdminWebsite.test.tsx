import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminWebsite from './AdminWebsite';

const state = vi.hoisted(() => ({ allowed: true, faq: false, gallery: false, hidden: [] as string[], localId: 'a', refresh: vi.fn(async () => {}) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: state.localId, refreshTenant: state.refresh, tenant: { config: { features: { faqEnabled: state.faq, galleryEnabled: state.gallery }, landing: { hiddenSections: state.hidden } } } }) }));
vi.mock('@/context/AdminPermissionsContext', () => ({ useAdminPermissions: () => ({ canAccessSection: () => state.allowed, isLoading: false }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/admin/website/WebsiteImages', () => ({ default: () => <div data-testid="website-images">Images {state.localId}</div> }));
vi.mock('@/components/admin/settings/faqs/FaqSettings', () => ({ default: () => <div data-testid="website-faq">FAQ</div> }));
vi.mock('@/components/admin/settings/gallery/GallerySettings', () => ({ default: () => <div data-testid="website-gallery">Gallery</div> }));
afterEach(() => { cleanup(); state.allowed = true; state.faq = false; state.gallery = false; state.hidden = []; state.localId = 'a'; vi.clearAllMocks(); });
const app = () => <MemoryRouter initialEntries={['/admin/website']}><Routes><Route path="/admin/website" element={<AdminWebsite />} /><Route path="/admin" element={<div>Dashboard</div>} /></Routes></MemoryRouter>;

it('shows images directly without a navbar when it is the only enabled option', async () => {
  render(app()); expect(await screen.findByTestId('website-images')).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading.querySelector('svg')).toBeNull();
  expect(heading.parentElement?.parentElement).not.toHaveClass('max-w-6xl');
});
it('shows only granted sections and immediately leaves a revoked active tab', async () => {
  state.faq = true; state.gallery = true; const view = render(app());
  const faq = screen.getByRole('tab', { name: 'admin.faq.title' });
  fireEvent.mouseDown(faq, { button: 0, ctrlKey: false });
  expect(await screen.findByTestId('website-faq')).toBeInTheDocument();
  state.faq = false; view.rerender(app());
  expect(screen.queryByRole('tab', { name: 'admin.faq.title' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('website-faq')).not.toBeInTheDocument();
  expect(await screen.findByTestId('website-images')).toBeInTheDocument();
  state.hidden = ['gallery']; view.rerender(app());
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});
it('denies direct navigation when Platform or local permissions disable Website', async () => {
  state.allowed = false; render(app()); expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  expect(screen.queryByTestId('website-images')).not.toBeInTheDocument();
});
it('resets the active view when switching location', async () => {
  state.gallery = true; const view = render(app());
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'gallery.title' }), { button: 0, ctrlKey: false });
  expect(await screen.findByTestId('website-gallery')).toBeInTheDocument();
  state.localId = 'b'; view.rerender(app());
  expect(await screen.findByText('Images b')).toBeInTheDocument();
});
