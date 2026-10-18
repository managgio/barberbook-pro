import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import es from '@/i18n/locales/es.json';
import { deleteGalleryItem, GalleryCollection, GalleryItem, getGallery, reorderGallery, saveGalleryCategory, saveGalleryItem } from '@/data/api/gallery';
import { ApiRequestError } from '@/lib/networkErrors';
import GallerySettings from './GallerySettings';

const scope = vi.hoisted(() => ({ localId: 'local-a' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: scope.localId }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string, values: Record<string, unknown> = {}) =>
  Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), (es as Record<string, string>)[key] || key) }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../LandingPublicationControl', () => ({ default: () => null }));
vi.mock('@/components/admin/InlineTranslationPopover', () => ({ default: ({ entityType, entityId, fieldKey }: { entityType: string; entityId: string; fieldKey: string }) => <span data-testid={`translation-${entityType}-${fieldKey}`}>{entityId}</span> }));
vi.mock('@/data/api/gallery', async (original) => ({ ...await original<typeof import('@/data/api/gallery')>(), getGallery: vi.fn(), saveGalleryItem: vi.fn(), deleteGalleryItem: vi.fn(), reorderGallery: vi.fn(), saveGalleryCategory: vi.fn() }));
const item = (id: string, title: string): GalleryItem => ({ id, title, description: 'Detalles', categoryId: 'cuts', version: 3, position: 0,
  imageFileId: `image-${id}`, imageUrl: `https://ik.imagekit.io/test/${id}.webp`, imageWidth: 800, imageHeight: 1000, beforeFileId: null, beforeUrl: null, beforeWidth: null, beforeHeight: null });
const data: GalleryCollection = { categories: [{ id: 'cuts', name: 'Cortes', version: 2 }], items: [item('a', 'Fade'), item('b', 'Clásico')], imageUsage: { used: 2, limit: 12 } };
const clients: QueryClient[] = [];
beforeEach(() => { vi.resetAllMocks(); scope.localId = 'local-a'; vi.mocked(getGallery).mockResolvedValue(data); });
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; });
const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><GallerySettings /></QueryClientProvider>); return client;
};

it('requires a category before adding work and creates a trimmed category', async () => {
  vi.mocked(getGallery).mockResolvedValue({ categories: [], items: [], imageUsage: { used: 0, limit: 12 } }); mount();
  await screen.findByText('Tu trabajo merece verse');
  expect(screen.getByRole('button', { name: 'Añadir trabajo' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Nueva categoría'), '  Color  ');
  await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
  await waitFor(() => expect(saveGalleryCategory).toHaveBeenCalledWith(null, 'Color'));
});

it('edits source fields with the original version, exposes translations and keeps the draft on conflict', async () => {
  vi.mocked(saveGalleryItem).mockRejectedValue(new ApiRequestError('GALLERY_CONFLICT', 409, 'HTTP'));
  mount(); await screen.findByText('Fade');
  await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
  expect(screen.getByTestId('translation-gallery_item-title')).toHaveTextContent('a');
  expect(screen.getByTestId('translation-gallery_item-description')).toHaveTextContent('a');
  await userEvent.clear(screen.getByLabelText('Título del trabajo'));
  await userEvent.type(screen.getByLabelText('Título del trabajo'), '  Nuevo estilo  ');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar trabajo' }));
  await waitFor(() => expect(saveGalleryItem).toHaveBeenCalledWith(data.items[0], { title: 'Nuevo estilo', description: 'Detalles', categoryId: 'cuts', imageFileId: 'image-a', beforeFileId: null }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar trabajo' })).toBeEnabled());
  expect(screen.getByLabelText('Título del trabajo')).toHaveValue('  Nuevo estilo  ');
});

it('prevents removal of nonempty categories and confirms work deletion with its version', async () => {
  mount(); await screen.findByText('Fade');
  expect(screen.getByRole('button', { name: 'Eliminar categoría: Cortes' })).toBeDisabled();
  await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
  expect(deleteGalleryItem).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(deleteGalleryItem).toHaveBeenCalledWith(data.items[0]));
});

it('reorders with keyboard and rolls back the complete collection on failure', async () => {
  vi.mocked(reorderGallery).mockRejectedValue(new Error('offline')); const client = mount(); await screen.findByText('Fade');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Mover trabajo: Fade' }), { key: 'ArrowDown' });
  await waitFor(() => expect(reorderGallery).toHaveBeenCalledWith(['a', 'b'], ['b', 'a']));
  await waitFor(() => expect(client.getQueryData(['gallery', 'local-a', 'admin'])).toEqual(data));
  expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Fade');
});

it('supports touch drag and discards canceled gestures', async () => {
  vi.mocked(reorderGallery).mockResolvedValue([...data.items].reverse()); mount(); await screen.findByText('Fade');
  const handle = screen.getByRole('button', { name: 'Mover trabajo: Fade' }); handle.setPointerCapture = vi.fn();
  screen.getAllByRole('listitem').forEach((row, index) => { row.getBoundingClientRect = () => ({ top: 100 + index * 100, height: 100 }) as DOMRect; });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 150 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 250 }); fireEvent.pointerCancel(handle); fireEvent.pointerUp(handle);
  expect(reorderGallery).not.toHaveBeenCalled();
  fireEvent.pointerDown(handle, { button: 0, pointerId: 2, clientY: 150 });
  fireEvent.pointerMove(handle, { pointerId: 2, clientY: 250 }); fireEvent.pointerUp(handle, { pointerId: 2 });
  await waitFor(() => expect(reorderGallery).toHaveBeenCalledWith(['a', 'b'], ['b', 'a']));
});

it('shows a retry action on fetch errors', async () => {
  vi.mocked(getGallery).mockRejectedValue(new Error('offline')); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar la galería');
  expect(screen.getByRole('button', { name: 'Añadir trabajo' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(getGallery).toHaveBeenCalledTimes(2));
});

it('uses the current location image count, blocks new work at capacity and still allows replacements', async () => {
  vi.mocked(getGallery).mockResolvedValue({ ...data, imageUsage: { used: 12, limit: 12 } });
  mount();
  await screen.findByText('12 de 12 imágenes');
  expect(screen.getByText(/Cupo de este local/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Añadir trabajo' })).toBeDisabled();
  await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
  expect(screen.getByRole('button', { name: 'Elegir imagen: Antes' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Guardar trabajo' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Guardar trabajo' }));
  await waitFor(() => expect(saveGalleryItem).toHaveBeenCalled());
});

it('refreshes capacity after deletion without invalidating another location’s gallery', async () => {
  vi.mocked(getGallery).mockResolvedValue({ ...data, imageUsage: { used: 12, limit: 12 } });
  vi.mocked(deleteGalleryItem).mockImplementation(async () => {
    vi.mocked(getGallery).mockResolvedValue({ ...data, items: [data.items[1]], imageUsage: { used: 11, limit: 12 } });
  });
  const client = mount();
  client.setQueryData(['gallery', 'local-b', 'admin'], data);
  await screen.findByText('12 de 12 imágenes');
  await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
  await screen.findByText('11 de 12 imágenes');
  expect(screen.getByRole('button', { name: 'Añadir trabajo' })).toBeEnabled();
  expect(client.getQueryState(['gallery', 'local-b', 'admin'])?.isInvalidated).toBe(false);
  expect(client.getQueryData(['gallery', 'local-b', 'admin'])).toEqual(data);
});

it('shows the selected location’s independent quota when switching away from a full gallery', async () => {
  vi.mocked(getGallery).mockImplementation(async () => ({ ...data, imageUsage: { used: scope.localId === 'local-a' ? 12 : 2, limit: 12 } }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const view = render(<QueryClientProvider client={client}><GallerySettings /></QueryClientProvider>);
  await screen.findByText('12 de 12 imágenes');
  expect(screen.getByRole('button', { name: 'Añadir trabajo' })).toBeDisabled();
  scope.localId = 'local-b';
  view.rerender(<QueryClientProvider client={client}><GallerySettings /></QueryClientProvider>);
  await screen.findByText('2 de 12 imágenes');
  expect(screen.getByRole('button', { name: 'Añadir trabajo' })).toBeEnabled();
  scope.localId = 'local-a';
  view.rerender(<QueryClientProvider client={client}><GallerySettings /></QueryClientProvider>);
  await screen.findByText('12 de 12 imágenes');
  expect(screen.getByRole('button', { name: 'Añadir trabajo' })).toBeDisabled();
});
