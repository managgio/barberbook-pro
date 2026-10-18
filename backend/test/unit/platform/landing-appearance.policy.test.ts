import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { normalizeHeadingFont, normalizeSecondaryColor, validateHeadingFontBytes, MAX_HEADING_FONT_BYTES } from '@/contexts/platform/domain/services/landing-appearance.policy';
import { PrepareLandingAppearanceUseCase } from '@/contexts/platform/application/use-cases/prepare-landing-appearance.use-case';
import { landingImageReferences } from '@/contexts/platform/domain/services/website-media.policy';
import { DomainError } from '@/shared/domain/domain-error';
import { TenantConfigService } from '@/tenancy/tenant-config.service';

const font = { fileId: 'font-a', url: 'https://cdn.test/heading.ttf', name: 'Brand headings', format: 'ttf' as const };
const invalid = (error: unknown) => error instanceof DomainError && error.code === 'LANDING_APPEARANCE_INVALID';

test('appearance defaults preserve existing behavior and clearing is explicit', () => {
  assert.equal(normalizeSecondaryColor(undefined), undefined);
  assert.equal(normalizeSecondaryColor(''), null);
  assert.equal(normalizeSecondaryColor('#ABCDEF'), '#abcdef');
  assert.equal(normalizeHeadingFont(undefined), undefined);
  assert.equal(normalizeHeadingFont(null), null);
  for (const value of ['brown', '#12', 'url(https://bad.test)', 123, {}]) assert.throws(() => normalizeSecondaryColor(value), invalid);
  for (const value of [{ ...font, fileId: '../other' }, { ...font, url: 'javascript:alert(1)' }, { ...font, format: 'svg' }, { ...font, name: 'a\nfont' }]) assert.throws(() => normalizeHeadingFont(value), invalid);
});

test('font container validation rejects wrong formats, oversized files and out-of-bounds tables', () => {
  assert.throws(() => validateHeadingFontBytes(new Uint8Array(MAX_HEADING_FONT_BYTES + 1), 'ttf'), invalid);
  assert.throws(() => validateHeadingFontBytes(Buffer.from('<html>invalid font</html>'), 'woff2'), invalid);
  const bytes = Buffer.alloc(128); bytes.writeUInt32BE(0x00010000); bytes.writeUInt16BE(4, 4);
  ['head', 'name', 'cmap', 'maxp'].forEach((tag, index) => { const offset = 12 + index * 16; bytes.write(tag, offset); bytes.writeUInt32BE(80, offset + 8); bytes.writeUInt32BE(8, offset + 12); });
  validateHeadingFontBytes(bytes, 'ttf');
  assert.throws(() => validateHeadingFontBytes(bytes, 'otf'), invalid);
  bytes.writeUInt32BE(99999, 20);
  assert.throws(() => validateHeadingFontBytes(bytes, 'ttf'), invalid);
});

test('use case resolves new fonts with brand and location scope, retaining unchanged assets and other settings', async () => {
  const calls: unknown[] = [];
  const useCase = new PrepareLandingAppearanceUseCase({ resolveFont: async (...args) => { calls.push(args); return { ...args[2], url: 'https://cdn.test/canonical.ttf' }; } });
  const original = { _revision: 'v1', theme: { primary: '#112233', mode: 'dark', secondary: '#AABBCC', headingFont: font }, branding: { name: 'Our business' } };
  const result = await useCase.execute('brand-a', null, original, {});
  assert.deepEqual(calls, [['brand-a', null, font]]);
  assert.deepEqual(result.theme, { ...original.theme, secondary: '#aabbcc', headingFont: { ...font, url: 'https://cdn.test/canonical.ttf' } });
  assert.deepEqual(result.branding, original.branding);
  await useCase.execute('brand-a', null, result, result);
  assert.equal(calls.length, 1);
  await useCase.execute('brand-a', 'local-b', original, {});
  assert.deepEqual(calls[1], ['brand-a', 'local-b', font]);
  const cleared = await useCase.execute('brand-a', null, { theme: { secondary: null, headingFont: null } }, original);
  assert.deepEqual(cleared.theme, { secondary: null, headingFont: null });
  assert.deepEqual(landingImageReferences(original), [{ fileId: font.fileId, url: font.url }]);
  assert.deepEqual(landingImageReferences(cleared), []);
});

test('public bootstrap inherits brand appearance across local primary overrides and allows explicit reset', async () => {
  const service = new TenantConfigService({} as any, {} as any, { isReadyForRoutineDelivery: () => false } as any, { isReadyForRoutineDelivery: () => false } as any);
  service.getBrandConfig = async () => ({ theme: { primary: '#123456', secondary: '#654321', headingFont: font } });
  service.getLocationConfig = async () => ({ theme: { primary: '#333333', mode: 'light' } });
  assert.deepEqual((await service.getPublicConfig()).theme, { primary: '#333333', mode: 'light', secondary: '#654321', headingFont: font });
  service.getLocationConfig = async () => ({ theme: { headingFont: null, secondary: null } });
  assert.deepEqual((await service.getPublicConfig()).theme, { primary: '#123456', secondary: null, headingFont: null });
});
