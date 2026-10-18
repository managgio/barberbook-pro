import { describe, expect, it, vi } from 'vitest';
import { contrastRatio, landingAppearanceStyle, MAX_HEADING_FONT_BYTES, readHeadingFont } from './landingAppearance';

describe('landing appearance', () => {
  it('keeps all existing tokens unchanged unless a valid secondary color is selected', () => {
    for (const value of [undefined, null, '', '#aab', 'red', 'url(bad)']) expect(landingAppearanceStyle(value)).toEqual({});
    expect(landingAppearanceStyle('#653c24')).toHaveProperty('--landing-secondary', '101 60 36');
  });
  it.each(['light', 'dark'])('keeps secondary labels readable in %s mode while retaining the chosen surface color', mode => {
    for (const color of ['#000000', '#ffffff', '#653c24', '#ffff00', '#0000ff', '#aabbcc']) {
      const style = landingAppearanceStyle(color, mode) as Record<string, string>;
      expect(contrastRatio(style['--landing-secondary-ink'].split(' ').map(Number), mode === 'light' ? [255, 255, 255] : [10, 10, 10])).toBeGreaterThanOrEqual(4.5);
      expect(style).not.toHaveProperty('--primary');
    }
  });
  it('rejects unsupported, oversized and disguised uploads before calling the browser sanitizer', async () => {
    vi.stubGlobal('FontFace', vi.fn());
    try {
      await expect(readHeadingFont(new File(['font'], 'font.svg'))).rejects.toThrow();
      await expect(readHeadingFont(new File([new Uint8Array(MAX_HEADING_FONT_BYTES + 1)], 'font.ttf'))).rejects.toThrow();
      const forged = new File([new Uint8Array(64)], 'font.ttf');
      Object.defineProperty(forged, 'arrayBuffer', { value: async () => new Uint8Array(64).buffer });
      await expect(readHeadingFont(forged)).rejects.toThrow();
      expect(FontFace).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
