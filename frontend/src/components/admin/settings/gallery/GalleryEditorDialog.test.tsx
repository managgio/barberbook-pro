import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { uploadToImageKit } from '@/lib/imagekit';
import GalleryEditorDialog from './GalleryEditorDialog';
import type { GalleryPhotoDraft } from './GalleryImagePicker';

vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: 'local-a' }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/imagekit', () => ({ uploadToImageKit: vi.fn() }));
vi.mock('@/components/admin/InlineTranslationPopover', () => ({ default: () => null }));
vi.mock('./GalleryImagePicker', () => ({ default: ({ label, onChange, disabled }: { label: string; onChange: (value: GalleryPhotoDraft) => void; disabled: boolean }) =>
  <button type="button" disabled={disabled} onClick={() => onChange({ url: '', fileId: null, blob: new Blob(['image'], { type: 'image/webp' }) })}>{label}</button> }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
const mount = (onSave = vi.fn().mockResolvedValue(false), maxImages = 12) => ({ onSave, ...render(<GalleryEditorDialog item={null} categories={[{ id: 'cuts', name: 'Cortes', version: 1 }]} busy={false} maxImages={maxImages} onClose={vi.fn()} onSave={onSave} onTranslationUpdated={vi.fn()} />) });
const fill = async () => { await userEvent.type(screen.getByLabelText('gallery.workTitle'), 'Fade'); await userEvent.click(screen.getByRole('button', { name: 'gallery.result' })); };

it('reuses uploaded media after a failed content save instead of uploading duplicates', async () => {
  vi.mocked(uploadToImageKit).mockResolvedValue({ fileId: 'image-a', url: 'https://ik.imagekit.io/test/a.webp' });
  const { onSave } = mount(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'gallery.save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: 'gallery.save' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'gallery.save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(uploadToImageKit).toHaveBeenCalledTimes(1);
  expect(uploadToImageKit).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.webp$/), 'gallery/local-a', expect.objectContaining({ localIdOverride: 'local-a', signal: expect.any(AbortSignal) }));
  expect(onSave).toHaveBeenLastCalledWith({ title: 'Fade', description: '', categoryId: 'cuts', imageFileId: 'image-a', beforeFileId: null });
});

it('allows only a result photo when one image slot remains, before any upload', async () => {
  vi.mocked(uploadToImageKit).mockResolvedValue({ fileId: 'image-a', url: 'https://ik.imagekit.io/test/a.webp' });
  const { onSave } = mount(undefined, 1);
  await fill();
  expect(screen.getByRole('button', { name: 'gallery.before' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'gallery.save' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'gallery.save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(uploadToImageKit).toHaveBeenCalledTimes(1);
});

it('blocks submission before uploading when capacity is exhausted while the editor is open', async () => {
  const { onSave, rerender } = mount();
  await fill();
  rerender(<GalleryEditorDialog item={null} categories={[{ id: 'cuts', name: 'Cortes', version: 1 }]} busy={false} maxImages={0}
    onClose={vi.fn()} onSave={onSave} onTranslationUpdated={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'gallery.save' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('gallery.capacityChanged');
  expect(uploadToImageKit).not.toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
});

it('retains the selected file when the upload response is malformed and permits retry', async () => {
  vi.mocked(uploadToImageKit).mockResolvedValueOnce({} as never).mockResolvedValueOnce({ fileId: 'image-a', url: 'https://ik.imagekit.io/test/a.webp' });
  const { onSave } = mount(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'gallery.save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('gallery.uploadError'); expect(onSave).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'gallery.save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(uploadToImageKit).toHaveBeenCalledTimes(2);
});
