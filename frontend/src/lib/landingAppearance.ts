import type { CSSProperties } from 'react';

export type HeadingFont = { fileId: string; url: string; name: string; format: 'ttf' | 'otf' | 'woff' | 'woff2' };
export type LandingAppearance = { secondary?: string | null; headingFont?: HeadingFont | null };
export const MAX_HEADING_FONT_BYTES = 2 * 1024 * 1024;
export const DEFAULT_HEADING_FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

export const validSecondaryColor = (value?: string | null) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const rgb = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
const luminance = (color: number[]) => color.map(channel => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
export const contrastRatio = (a: number[], b: number[]) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

export function landingAppearanceStyle(color?: string | null, mode?: string): CSSProperties {
  if (!validSecondaryColor(color)) return {};
  const source = rgb(color!);
  const background = mode === 'light' ? [255, 255, 255] : [10, 10, 10];
  const target = mode === 'light' ? 0 : 255;
  let readable = source;
  // Keep the chosen hue, adjusting only the ink used for small accent labels.
  for (let step = 1; contrastRatio(readable, background) < 4.5 && step <= 100; step++) {
    readable = source.map(channel => Math.round(channel + (target - channel) * step / 100));
  }
  return { '--landing-secondary': source.join(' '), '--landing-secondary-ink': readable.join(' ') } as CSSProperties;
}

export async function readHeadingFont(file: File): Promise<{ bytes: ArrayBuffer; format: HeadingFont['format'] }> {
  const format = file.name.split('.').pop()?.toLowerCase() as HeadingFont['format'];
  if (!['ttf', 'otf', 'woff', 'woff2'].includes(format) || file.size < 12 || file.size > MAX_HEADING_FONT_BYTES) throw new Error('FONT_INVALID');
  const bytes = await file.arrayBuffer();
  const signature = new DataView(bytes).getUint32(0);
  if (signature !== { ttf: 0x00010000, otf: 0x4f54544f, woff: 0x774f4646, woff2: 0x774f4632 }[format]) throw new Error('FONT_INVALID');
  // FontFace invokes the browser font sanitizer, including table and glyph validation.
  if (typeof FontFace !== 'undefined') await new FontFace('ManaggioFontValidation', bytes).load();
  return { bytes, format };
}
