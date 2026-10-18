import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WebsiteImageEditor from './WebsiteImageEditor';
import { WebsiteImageSection } from '@/data/api/website';

const api = vi.hoisted(() => ({ upload: vi.fn(), optimize: vi.fn(), discard: vi.fn(async () => {}) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string, values?: Record<string, unknown>) => `${key}${values?.number ? ` ${values.number}` : ''}` }) }));
vi.mock('@/lib/imagekit', () => ({ uploadToImageKit: api.upload }));
vi.mock('@/lib/galleryImages', async (original) => ({ ...await original<typeof import('@/lib/galleryImages')>(), optimizeGalleryImage: api.optimize }));
vi.mock('@/data/api/website', () => ({ discardWebsiteUpload: api.discard }));
const section: WebsiteImageSection = { key: 'hero', kind: 'hero', limit: 5, images: [{ fileId: 'old', url: 'https://images.test/old.webp' }, { fileId: 'second', url: 'https://images.test/second.webp' }] };
beforeEach(() => {
  api.optimize.mockResolvedValue(new Blob(['photo'], { type: 'image/webp' })); api.upload.mockResolvedValue({ fileId: 'new', url: 'https://images.test/new.webp' });
  vi.stubGlobal('URL', class extends URL { static createObjectURL() { return 'blob:preview'; } static revokeObjectURL() {} });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const editor = (save = vi.fn(async () => true), close = vi.fn(), value = section) => ({ save, close, element: <WebsiteImageEditor section={value} title="Main photo" brandId="brand-a" localId="local-a" onClose={close} onSave={save} /> });
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
const measureGrid = (columns = 3, viewportHeight = 1000) => {
  const grid = screen.getByRole('list', { name: 'website.photoOrder' });
  const scroll = grid.parentElement!;
  grid.getBoundingClientRect = () => rect(20, 40, columns * 200, 520);
  scroll.getBoundingClientRect = () => rect(0, 0, 640, viewportHeight);
  const items = screen.getAllByRole('listitem');
  items.forEach((item, index) => { item.getBoundingClientRect = () => rect(20 + index % columns * 200, 40 + Math.floor(index / columns) * 260, 180, 240); });
  const handle = screen.getByRole('button', { name: 'website.dragPhoto 1' });
  handle.setPointerCapture = vi.fn();
  return { grid, scroll, handle, items };
};
const pickUp = (handle: HTMLElement) => fireEvent.pointerDown(handle, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 100, clientY: 250 });

it('reorders retained photos and only publishes on explicit save', async () => {
  const { element, save } = editor(); render(element);
  const { handle } = measureGrid();
  fireEvent.keyDown(handle, { key: ' ' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'website.savePhotos' })).toBeDisabled();
  fireEvent.keyDown(handle, { key: ' ' });
  expect(save).not.toHaveBeenCalled(); expect(api.discard).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'website.savePhotos' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith([{ fileId: 'second' }, { fileId: 'old' }]));
  expect(api.upload).not.toHaveBeenCalled();
});

it.each([2, 3])('drags across columns and rows in a %i-column grid, without publishing or opening the photo picker', async (columns) => {
  const expanded = { ...section, images: [...section.images, ...['third', 'fourth', 'fifth'].map((fileId) => ({ fileId, url: `https://images.test/${fileId}.webp` }))] };
  const { element, save } = editor(undefined, undefined, expanded); render(element);
  const { handle, items } = measureGrid(columns);
  const destination = items[4].getBoundingClientRect();
  pickUp(handle);
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100 + destination.left - 20, clientY: 250 + destination.top - 40 });
  expect(document.querySelector('[data-photo-drag-preview]')).toBeInTheDocument();
  expect(document.querySelector('[data-photo-drop-target]')).toBeInTheDocument();
  expect(items[0]).toHaveStyle({ opacity: '0' });
  expect(items[1].style.transform).not.toBe('');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'website.removePhoto 2' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /website.move(Earlier|Later)/ })).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(document.querySelector('[data-photo-drag-preview]')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'website.savePhotos' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(['second', 'third', 'fourth', 'fifth', 'old'].map((fileId) => ({ fileId }))));
  expect(api.upload).not.toHaveBeenCalled(); expect(api.discard).not.toHaveBeenCalled();
});

it.each(['pointerCancel', 'outside', 'resize'])('keeps the original order after an interrupted drag: %s', async (reason) => {
  const { element, save } = editor(); render(element);
  const { handle } = measureGrid(); pickUp(handle);
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300, clientY: 250 });
  if (reason === 'pointerCancel') fireEvent.pointerCancel(handle, { pointerId: 1 });
  if (reason === 'resize') fireEvent(window, new Event('resize'));
  if (reason === 'outside') fireEvent.pointerMove(handle, { pointerId: 1, clientX: 1000, clientY: 250 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'website.savePhotos' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith([{ fileId: 'old' }, { fileId: 'second' }]));
});

it('Escape cancels keyboard reordering without closing the editor or changing photos', () => {
  const { element, close } = editor(); render(element);
  const { handle } = measureGrid();
  fireEvent.keyDown(handle, { key: ' ' }); fireEvent.keyDown(handle, { key: 'ArrowRight' });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(document.querySelector('[data-photo-drag-preview]')).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'website.photoNumber 1' })).toHaveAttribute('src', section.images[0].url);
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});

it('autoscrolls the dialog near the edge and stops immediately on cancellation', () => {
  const { element } = editor(); render(element);
  const { handle, scroll } = measureGrid(2, 280);
  let scrollTop = 0;
  Object.defineProperty(scroll, 'scrollTop', { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = Math.max(0, Math.min(300, value)); } });
  vi.useFakeTimers(); pickUp(handle);
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300, clientY: 270 });
  act(() => vi.advanceTimersByTime(64));
  expect(scrollTop).toBeGreaterThan(0);
  fireEvent.pointerCancel(handle, { pointerId: 1 });
  const stopped = scrollTop; act(() => vi.advanceTimersByTime(128));
  expect(scrollTop).toBe(stopped);
});

it('does not show a reorder handle when there is only one photo', () => {
  render(editor(undefined, undefined, { ...section, images: [section.images[0]] }).element);
  expect(screen.queryByRole('button', { name: /website.dragPhoto/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'website.replacePhoto 1' })).toBeEnabled();
});
it('removing a photo does not delete the live file before the save succeeds', async () => {
  const { element, save } = editor(); render(element);
  fireEvent.click(screen.getByRole('button', { name: 'website.removePhoto 1' }));
  expect(api.discard).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'website.savePhotos' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith([{ fileId: 'second' }]));
});
it('optimises a replacement, uploads to the captured location and reuses it on retry', async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const { element } = editor(save); const view = render(element);
  fireEvent.click(screen.getByRole('button', { name: 'website.replacePhoto 1' }));
  fireEvent.change(screen.getByLabelText('website.replacePhoto 1', { selector: 'input' }), { target: { files: [new File(['raw'], 'photo.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'website.savePhotos' })).not.toBeDisabled());
  expect(api.upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'website.savePhotos' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith([{ fileId: 'new' }, { fileId: 'second' }]));
  expect(api.upload.mock.calls[0][2]).toBe('website/brand-a/local-a');
  expect(api.upload.mock.calls[0][3].localIdOverride).toBe('local-a');
  await waitFor(() => expect(screen.getByRole('button', { name: 'website.savePhotos' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'website.savePhotos' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(api.upload).toHaveBeenCalledTimes(1); view.unmount(); expect(api.discard).not.toHaveBeenCalled();
});
it('queues an unused upload for safe cleanup after a failed save and closing', async () => {
  const save = vi.fn(async () => false); const { element } = editor(save); const view = render(element);
  fireEvent.click(screen.getByRole('button', { name: 'website.replacePhoto 1' }));
  fireEvent.change(screen.getByLabelText('website.replacePhoto 1', { selector: 'input' }), { target: { files: [new File(['raw'], 'photo.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'website.savePhotos' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'website.savePhotos' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1)); view.unmount();
  expect(api.discard).toHaveBeenCalledWith('local-a', 'new');
});
