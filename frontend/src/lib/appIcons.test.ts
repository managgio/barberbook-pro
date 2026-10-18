import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Managgio shortcut icons before bootstrap', () => {
  it('declares real square PNG assets at their advertised sizes, including the iOS touch icon', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const head = new DOMParser().parseFromString(html, 'text/html').head;
    for (const [rel, size] of [['icon', 192], ['apple-touch-icon', 180]] as const) {
      const links = head.querySelectorAll(`link[rel="${rel}"]`);
      expect(links).toHaveLength(1);
      const link = links[0];
      expect(link.getAttribute('type')).toBe('image/png');
      expect(link.getAttribute('sizes')).toBe(`${size}x${size}`);
      const assetPath = link.getAttribute('href')!.split('?')[0];
      const png = readFileSync(resolve(process.cwd(), 'public', assetPath.slice(1)));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });
});
