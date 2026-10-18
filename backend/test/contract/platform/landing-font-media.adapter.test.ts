import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ImagekitLandingFontAdapter } from '@/modules/website/imagekit-landing-font.adapter';
import { DomainError } from '@/shared/domain/domain-error';

const font = { fileId: 'font-a', url: 'https://untrusted.test/not-used.ttf', name: 'Our font', format: 'ttf' as const };
const bytes = Buffer.alloc(128); bytes.writeUInt32BE(0x00010000); bytes.writeUInt16BE(4, 4);
['head', 'name', 'cmap', 'maxp'].forEach((tag, index) => { const offset = 12 + index * 16; bytes.write(tag, offset); bytes.writeUInt32BE(80, offset + 8); bytes.writeUInt32BE(8, offset + 12); });
const details = { fileId: 'font-a', fileType: 'non-image', filePath: '/tenant/website/brand-a/brand/fonts/head.ttf', url: 'https://cdn.test/account/tenant/website/brand-a/brand/fonts/head.ttf', size: bytes.length };
const config = { getBrandConfig: async (brandId: string) => { assert.equal(brandId, 'brand-a'); return { imagekit: { privateKey: 'test-only', urlEndpoint: 'https://cdn.test/account' } }; } };
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;

test('font adapter uses provider metadata and bounded bytes, never the supplied URL', async () => {
  const original = global.fetch; const urls: string[] = [];
  global.fetch = async (input) => { urls.push(String(input)); return String(input).endsWith('/details') ? Response.json(details) : new Response(bytes); };
  try {
    const result = await new ImagekitLandingFontAdapter(config as any).resolveFont('brand-a', null, font);
    assert.equal(result.url, details.url);
    assert.deepEqual(urls, ['https://api.imagekit.io/v1/files/font-a/details', details.url]);
  } finally { global.fetch = original; }
});

test('font adapter rejects other tenants, other local folders, forged media and malformed font content', async () => {
  const original = global.fetch;
  try {
    for (const change of [
      { filePath: '/tenant/website/other/brand/fonts/head.ttf' }, { filePath: '/tenant/website/brand-a/local-b/fonts/head.ttf' },
      { url: 'https://attacker.test/account/head.ttf' }, { fileType: 'image' }, { size: 3 * 1024 * 1024 },
      { filePath: '/tenant/website/brand-a/brand/fonts/head.svg' }, { fileId: 'foreign' },
    ]) {
      global.fetch = async () => Response.json({ ...details, ...change });
      await assert.rejects(() => new ImagekitLandingFontAdapter(config as any).resolveFont('brand-a', null, font), code('LANDING_APPEARANCE_INVALID'));
    }
    global.fetch = async (input) => String(input).endsWith('/details') ? Response.json(details) : new Response(Buffer.alloc(128));
    await assert.rejects(() => new ImagekitLandingFontAdapter(config as any).resolveFont('brand-a', null, font), code('LANDING_APPEARANCE_INVALID'));
    global.fetch = async () => { throw new Error('provider secret must not be exposed'); };
    await assert.rejects(() => new ImagekitLandingFontAdapter(config as any).resolveFont('brand-a', null, font), error => code('LANDING_FONT_UNAVAILABLE')(error) && !(error as Error).message.includes('secret'));
  } finally { global.fetch = original; }
});
