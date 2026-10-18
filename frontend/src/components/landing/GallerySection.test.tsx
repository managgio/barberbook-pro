import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getGallery, GalleryItem } from '@/data/api/gallery';
import GallerySection from './GallerySection';

const state = vi.hoisted(() => ({ enabled: false, local: 'a', language: 'es' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: state.local, tenant: { config: { features: { galleryEnabled: state.enabled } } } }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ language: state.language, t: (key: string, params: Record<string, unknown> = {}) => `${key}${params.title ? `: ${params.title}` : ''}` }) }));
vi.mock('@/data/api/gallery', () => ({ getGallery: vi.fn() }));
const clients: QueryClient[] = [];
const work = (id: string, categoryId: string): GalleryItem => ({ id, title: id, categoryId, description: '<script>safe text</script>', position: 0, version: 1,
  imageFileId: id, imageUrl: `https://ik.imagekit.io/test/${id}.webp`, imageWidth: 1000, imageHeight: 1200,
  beforeUrl: `https://ik.imagekit.io/test/${id}-before.webp`, beforeFileId: `${id}-before`, beforeWidth: 1000, beforeHeight: 1200 });
const collection = { categories: [{ id: 'cuts', name: 'Cortes', version: 1 }, { id: 'nails', name: 'Manicura', version: 1 }], items: [work('Fade', 'cuts'), work('French', 'nails')] };
beforeEach(() => { vi.resetAllMocks(); state.enabled = true; state.local = 'a'; state.language = 'es'; });
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; });
const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return { client, ...render(<QueryClientProvider client={client}><GallerySection /></QueryClientProvider>) };
};

it('does not fetch a disabled gallery and hides an unpublished or empty gallery', async () => {
  state.enabled = false; const view = mount(); expect(view.container).toBeEmptyDOMElement(); expect(getGallery).not.toHaveBeenCalled();
  state.enabled = true; vi.mocked(getGallery).mockResolvedValue({ items: [], categories: [] });
  view.rerender(<QueryClientProvider client={view.client}><GallerySection /></QueryClientProvider>);
  await waitFor(() => expect(getGallery).toHaveBeenCalled()); expect(view.container).toBeEmptyDOMElement();
});

it('filters categories, renders lazy responsive images and isolates cache by tenant and language', async () => {
  state.language = 'en'; vi.mocked(getGallery).mockResolvedValue(collection); const { client } = mount();
  await screen.findByRole('button', { name: 'gallery.view: Fade' });
  const thumbnail = screen.getByRole('button', { name: 'gallery.view: Fade' }).querySelector('img');
  expect(thumbnail).toHaveAttribute('loading', 'lazy'); expect(thumbnail).toHaveAttribute('srcset'); expect(thumbnail).toHaveAttribute('width', '1000');
  await userEvent.click(screen.getByRole('button', { name: 'Manicura' }));
  expect(screen.queryByRole('button', { name: 'gallery.view: Fade' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'gallery.view: French' })).toBeInTheDocument();
  expect(client.getQueryData(['gallery', 'a', 'en'])).toEqual(collection);
  expect(client.getQueryData(['gallery', 'b', 'en'])).toBeUndefined();
});

it('compares directly on the image with one accessible control and preserves gallery navigation', async () => {
  vi.mocked(getGallery).mockResolvedValue(collection); mount();
  await userEvent.click(await screen.findByRole('button', { name: 'gallery.view: Fade' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('<script>safe text</script>')).toBeInTheDocument(); expect(dialog.querySelector('script')).toBeNull();
  const slider = within(dialog).getByRole('slider', { name: 'gallery.comparison' });
  expect(within(dialog).getAllByRole('slider')).toHaveLength(1);
  expect(dialog.querySelector('input[type="range"]')).toBeNull();
  const comparison = within(dialog).getByAltText('Fade').parentElement!;
  expect(comparison).toContainElement(slider);
  comparison.setPointerCapture = vi.fn();
  comparison.getBoundingClientRect = () => ({ left: 0, width: 400 }) as DOMRect;
  fireEvent.pointerDown(comparison, { button: 0, pointerId: 1, clientX: 100, isPrimary: true });
  expect(slider).toHaveAttribute('aria-valuenow', '25'); expect(slider).toHaveFocus();
  fireEvent.pointerMove(comparison, { pointerId: 1, clientX: 300 });
  expect(slider).toHaveAttribute('aria-valuenow', '75');
  fireEvent.pointerMove(comparison, { pointerId: 2, clientX: 200 });
  expect(slider).toHaveAttribute('aria-valuenow', '75');
  fireEvent.pointerCancel(comparison, { pointerId: 1 });
  fireEvent.pointerMove(comparison, { pointerId: 1, clientX: 200 });
  expect(slider).toHaveAttribute('aria-valuenow', '75');
  await userEvent.click(within(dialog).getByRole('button', { name: 'gallery.next' }));
  expect(within(dialog).getByRole('heading', { name: 'French' })).toBeInTheDocument();
  expect(within(dialog).getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
});

it('supports keyboard comparison, clamps both ends and keeps arrows scoped to the focused control', async () => {
  const user = userEvent.setup();
  vi.mocked(getGallery).mockResolvedValue(collection); mount();
  await user.click(await screen.findByRole('button', { name: 'gallery.view: Fade' }));
  const dialog = screen.getByRole('dialog');
  const slider = within(dialog).getByRole('slider', { name: 'gallery.comparison' });
  slider.focus();
  await user.keyboard('{ArrowRight}{ArrowUp}');
  expect(slider).toHaveAttribute('aria-valuenow', '60');
  expect(within(dialog).getByRole('heading', { name: 'Fade' })).toBeInTheDocument();
  await user.keyboard('{PageDown}'); expect(slider).toHaveAttribute('aria-valuenow', '50');
  await user.keyboard('{Home}{ArrowLeft}'); expect(slider).toHaveAttribute('aria-valuenow', '0');
  await user.keyboard('{End}{ArrowRight}'); expect(slider).toHaveAttribute('aria-valuenow', '100');
  await user.keyboard('{ArrowDown}{PageUp}'); expect(slider).toHaveAttribute('aria-valuenow', '100');
  within(dialog).getByRole('button', { name: 'gallery.next' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(within(dialog).getByRole('heading', { name: 'French' })).toBeInTheDocument();
});

it('shows a normal full image without comparison controls when there is no before photo', async () => {
  vi.mocked(getGallery).mockResolvedValue({ ...collection, items: [{ ...work('Fade', 'cuts'), beforeUrl: null, beforeFileId: null }] });
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'gallery.view: Fade' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByAltText('Fade')).toBeInTheDocument();
  expect(within(dialog).queryByRole('slider')).not.toBeInTheDocument();
  expect(within(dialog).queryByText('gallery.compareHint')).not.toBeInTheDocument();
});

it('bounds initial rendering and reveals further works on demand', async () => {
  vi.mocked(getGallery).mockResolvedValue({ ...collection, items: Array.from({ length: 15 }, (_, i) => work(`Work ${i}`, 'cuts')) });
  mount(); await screen.findByRole('button', { name: 'gallery.more' });
  expect(screen.getAllByRole('button', { name: /^gallery.view:/ })).toHaveLength(12);
  await userEvent.click(screen.getByRole('button', { name: 'gallery.more' }));
  expect(screen.getAllByRole('button', { name: /^gallery.view:/ })).toHaveLength(15);
});
