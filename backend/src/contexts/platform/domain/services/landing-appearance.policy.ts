import { DomainError } from '../../../../shared/domain/domain-error';

export const MAX_HEADING_FONT_BYTES = 2 * 1024 * 1024;
export type HeadingFontFormat = 'ttf' | 'otf' | 'woff' | 'woff2';
export type HeadingFont = { fileId: string; url: string; name: string; format: HeadingFontFormat };
export type LandingAppearance = { secondary?: string | null; headingFont?: HeadingFont | null };
const invalid = (): never => { throw new DomainError('Invalid landing appearance.', 'LANDING_APPEARANCE_INVALID'); };

export function normalizeSecondaryColor(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value.trim())) return invalid();
  return value.trim().toLowerCase();
}

export function normalizeHeadingFont(value: unknown): HeadingFont | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object' || Array.isArray(value)) return invalid();
  const font = value as Record<string, unknown>;
  if (typeof font.fileId !== 'string' || !/^[\w-]{1,128}$/.test(font.fileId) ||
    typeof font.name !== 'string' || !font.name.trim() || font.name.length > 120 || /[\x00-\x1f\x7f]/.test(font.name) ||
    !['ttf', 'otf', 'woff', 'woff2'].includes(String(font.format)) || typeof font.url !== 'string' || font.url.length > 2048) return invalid();
  try {
    const url = new URL(font.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return invalid();
  } catch { return invalid(); }
  return { fileId: font.fileId, url: font.url, name: font.name.trim(), format: font.format as HeadingFontFormat };
}

// Validate the container before publishing. Browsers also sanitize the actual font tables.
export function validateHeadingFontBytes(bytes: Uint8Array, format: HeadingFontFormat): void {
  if (bytes.byteLength < 12 || bytes.byteLength > MAX_HEADING_FONT_BYTES) return invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0);
  const expected = { ttf: 0x00010000, otf: 0x4f54544f, woff: 0x774f4646, woff2: 0x774f4632 };
  if (signature !== expected[format]) return invalid();
  if (format === 'ttf' || format === 'otf') {
    const count = view.getUint16(4);
    if (!count || count > 128 || 12 + count * 16 > bytes.length) return invalid();
    const tags = new Set<string>();
    for (let i = 0; i < count; i++) {
      const at = 12 + i * 16;
      const tag = String.fromCharCode(...bytes.slice(at, at + 4));
      const offset = view.getUint32(at + 8), length = view.getUint32(at + 12);
      if (tags.has(tag) || offset < 12 + count * 16 || offset + length > bytes.length) return invalid();
      tags.add(tag);
    }
    if (!['head', 'cmap', 'name', 'maxp'].every(tag => tags.has(tag))) return invalid();
  } else {
    const headerSize = format === 'woff' ? 44 : 48;
    if (bytes.length < headerSize || view.getUint32(8) !== bytes.length || !view.getUint16(12) || view.getUint16(12) > 128 ||
      view.getUint16(14) !== 0 || view.getUint32(16) > 16 * 1024 * 1024) return invalid();
    if (format === 'woff' && headerSize + view.getUint16(12) * 20 > bytes.length) return invalid();
    if (format === 'woff2' && (view.getUint32(20) === 0 || view.getUint32(20) > bytes.length - headerSize)) return invalid();
  }
}
