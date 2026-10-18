import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BrandLandingAppearanceEditor from './BrandLandingAppearanceEditor';
import { readHeadingFont, type LandingAppearance } from '@/lib/landingAppearance';
import { uploadToImageKit } from '@/lib/imagekit';

vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/imagekit', () => ({ uploadToImageKit: vi.fn() }));
vi.mock('@/lib/landingAppearance', async importOriginal => ({ ...await importOriginal<object>(), readHeadingFont: vi.fn() }));
const changed = vi.fn(), busy = vi.fn();
const originalFont = { fileId: 'old', url: 'https://cdn.test/old.ttf', name: 'Old font', format: 'ttf' as const };
const file = new File(['font fixture'], 'Our font.ttf');
function Editor({ initial = {} }: { initial?: LandingAppearance }) {
  const [value, setValue] = useState(initial);
  return <BrandLandingAppearanceEditor brandId="brand-a" subdomain="brand-a" value={value} primary="#ffaa00" mode="dark" disabled={false}
    onBusyChange={busy} onChange={updates => { changed(updates); setValue(previous => ({ ...previous, ...updates })); }} />;
}
const pick = () => fireEvent.change(screen.getByLabelText('platform.appearance.uploadFont', { selector: 'input' }), { target: { files: [file] } });
beforeEach(() => { vi.resetAllMocks(); vi.mocked(readHeadingFont).mockResolvedValue({ bytes: new ArrayBuffer(12), format: 'ttf' }); });
afterEach(cleanup);

it('keeps defaults, rejects incomplete colors and allows explicitly restoring the current design', async () => {
  const { container } = render(<Editor />);
  expect(screen.getByText('platform.appearance.defaultFont')).toBeInTheDocument();
  expect(container.querySelector('[data-secondary]')).toBeNull();
  const field = screen.getByLabelText('platform.appearance.secondary');
  fireEvent.change(field, { target: { value: '#ab' } });
  expect(field).toHaveAttribute('aria-invalid', 'true'); expect(changed).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: '#654321' } });
  expect(changed).toHaveBeenLastCalledWith({ secondary: '#654321' });
  expect(container.querySelector('[data-secondary]')).not.toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'platform.appearance.resetColor' }));
  expect(changed).toHaveBeenLastCalledWith({ secondary: null });
  expect(container.querySelector('[data-secondary]')).toBeNull();
});

it('validates first, uploads under the captured brand and only replaces the font after upload succeeds', async () => {
  let finish!: (value: { fileId: string; url: string }) => void;
  vi.mocked(uploadToImageKit).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<Editor initial={{ headingFont: originalFont }} />); pick();
  await waitFor(() => expect(uploadToImageKit).toHaveBeenCalledWith(file, expect.stringMatching(/^heading-\d+\.ttf$/), 'website/brand-a/brand/fonts', expect.objectContaining({ subdomainOverride: 'brand-a', signal: expect.any(AbortSignal) })));
  expect(changed).not.toHaveBeenCalled(); expect(screen.getByText('Old font')).toBeInTheDocument();
  expect(busy).toHaveBeenLastCalledWith(true);
  await act(async () => finish({ fileId: 'new', url: 'https://cdn.test/new.ttf' }));
  expect(changed).toHaveBeenLastCalledWith({ headingFont: { fileId: 'new', url: 'https://cdn.test/new.ttf', name: 'Our font', format: 'ttf' } });
  expect(busy).toHaveBeenLastCalledWith(false);
  await userEvent.click(screen.getByRole('button', { name: 'platform.appearance.resetFont' }));
  expect(changed).toHaveBeenLastCalledWith({ headingFont: null });
});

it('keeps the published font on invalid files or upload failure and permits retry', async () => {
  vi.mocked(readHeadingFont).mockRejectedValueOnce(new Error('Invalid font'));
  render(<Editor initial={{ headingFont: originalFont }} />); pick();
  expect(await screen.findByRole('alert')).toHaveTextContent('platform.appearance.fontInvalid');
  expect(uploadToImageKit).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  vi.mocked(uploadToImageKit).mockRejectedValueOnce(new Error('Offline')); pick();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('platform.appearance.uploadError'));
  expect(changed).not.toHaveBeenCalled(); expect(screen.getByText('Old font')).toBeInTheDocument();
  expect(busy).toHaveBeenLastCalledWith(false);
});

it('aborts an upload when leaving a brand and ignores its late result', async () => {
  let finish!: (value: { fileId: string; url: string }) => void;
  vi.mocked(uploadToImageKit).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { unmount } = render(<Editor />); pick();
  await waitFor(() => expect(uploadToImageKit).toHaveBeenCalled());
  const signal = vi.mocked(uploadToImageKit).mock.calls[0][3]!.signal!;
  unmount(); expect(signal.aborted).toBe(true);
  await act(async () => finish({ fileId: 'late', url: 'https://cdn.test/late.ttf' }));
  expect(changed).not.toHaveBeenCalled(); expect(busy).toHaveBeenLastCalledWith(false);
});
