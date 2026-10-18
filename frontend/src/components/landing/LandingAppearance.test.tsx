import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LandingAppearance from './LandingAppearance';

const font = { fileId: 'font-a', name: 'Headings', url: 'https://cdn.test/a.ttf', format: 'ttf' as const };
let pending: Array<{ resolve: () => void; reject: () => void }>;
const add = vi.fn(), remove = vi.fn();
beforeEach(() => {
  pending = []; add.mockClear(); remove.mockClear();
  Object.defineProperty(document, 'fonts', { configurable: true, value: { add, delete: remove } });
  vi.stubGlobal('FontFace', class { load() { return new Promise((resolve, reject) => pending.push({ resolve: () => resolve(this), reject: () => reject(new Error('unavailable')) })); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Reflect.deleteProperty(document, 'fonts'); });

it('does not load fonts or override colors by default', () => {
  const { container } = render(<LandingAppearance><h1 className="landing-heading">Default</h1><p>Body</p></LandingAppearance>);
  expect(container.firstChild).not.toHaveAttribute('data-secondary');
  expect(container.firstChild).not.toHaveAttribute('data-heading-font');
  expect(pending).toHaveLength(0);
});
it('isolates the loaded font and secondary tokens to its own landing, including previews', async () => {
  const { container, unmount } = render(<><LandingAppearance appearance={{ headingFont: font, secondary: '#653c24' }}><h1 className="landing-heading">Custom</h1></LandingAppearance><LandingAppearance><h1>Default</h1></LandingAppearance></>);
  await act(async () => pending[0].resolve());
  expect(container.children[0]).toHaveAttribute('data-heading-font');
  expect(container.children[0]).toHaveAttribute('data-secondary');
  expect(container.children[1]).not.toHaveAttribute('data-heading-font');
  expect(document.documentElement.style.getPropertyValue('--landing-heading-font')).toBe('');
  unmount(); expect(remove).toHaveBeenCalledTimes(1);
});
it('drops the previous tenant font immediately and ignores stale font loads', async () => {
  const { container, rerender } = render(<LandingAppearance appearance={{ headingFont: font }}>A</LandingAppearance>);
  rerender(<LandingAppearance appearance={{ headingFont: { ...font, url: 'https://cdn.test/b.ttf' } }}>B</LandingAppearance>);
  await act(async () => pending[0].resolve());
  expect(add).not.toHaveBeenCalled();
  expect(container.firstChild).not.toHaveAttribute('data-heading-font');
  await act(async () => pending[1].resolve());
  expect(container.firstChild).toHaveAttribute('data-heading-font');
  rerender(<LandingAppearance appearance={{ headingFont: null }}>Default</LandingAppearance>);
  expect(container.firstChild).not.toHaveAttribute('data-heading-font');
  expect(remove).toHaveBeenCalledTimes(2);
});
it('keeps content visible when the CDN font fails', async () => {
  const { container } = render(<LandingAppearance appearance={{ headingFont: font }}>Visible content</LandingAppearance>);
  await act(async () => pending[0].reject());
  expect(screen.getByText('Visible content')).toBeVisible();
  await waitFor(() => expect(container.firstChild).not.toHaveAttribute('data-heading-font'));
});
