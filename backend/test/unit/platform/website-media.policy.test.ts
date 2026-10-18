import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { isWebsiteEnabled, landingImageReferences, mergeWebsiteConfig, replaceWebsiteImages, websiteImageSections, WebsiteConfig } from '@/contexts/platform/domain/services/website-media.policy';
import { ManageWebsiteImagesUseCase } from '@/contexts/platform/application/use-cases/manage-website-images.use-case';
import { WebsiteMediaPort } from '@/contexts/platform/ports/outbound/website-media.port';
import { DomainError } from '@/shared/domain/domain-error';
import { RequestContext } from '@/shared/application/request-context';

const config: WebsiteConfig = { adminSidebar: { visibleSections: ['website'] }, features: { faqEnabled: false }, branding: { heroImageUrl: 'https://images.test/old.jpg', heroImageFileId: 'old', heroImage2Url: 'https://images.test/2.jpg', heroImage2FileId: 'two' }, landing: { presentation: { sections: [{ enabled: true, title: 'Our salon', body: 'About us' }, { enabled: false }] } } };
const context: RequestContext = { brandId: 'brand', localId: 'local', tenantId: 'brand', actorUserId: 'admin', timezone: 'Europe/Madrid', correlationId: 'test' };
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;

test('website is opt-in and explicit hiding wins over enabling', () => {
  assert.equal(isWebsiteEnabled({}), false);
  assert.equal(isWebsiteEnabled(config), true);
  assert.equal(isWebsiteEnabled({ adminSidebar: { visibleSections: ['website'], hiddenSections: ['website'] } }), false);
  assert.throws(() => replaceWebsiteImages({}, {}, 'hero', []), code('WEBSITE_DISABLED'));
});
test('image sections reflect hero and presentation switches and hidden sections', () => {
  assert.deepEqual(websiteImageSections(config).map((section) => section.key), ['hero', 'background', 'presentation-0', 'cta']);
  assert.deepEqual(websiteImageSections({ branding: { heroImageEnabled: false }, landing: { hiddenSections: ['presentation', 'cta'] } }).map((section) => section.key), ['background']);
  assert.throws(() => replaceWebsiteImages({}, { ...config, branding: { heroImageEnabled: false } }, 'hero', []), code('WEBSITE_SECTION_DISABLED'));
});
test('local replacements preserve settings and inherit untouched image fields without leaking capabilities', () => {
  const local = { theme: { primary: '#123456' }, branding: { heroBackgroundUrl: 'background' }, features: { faqEnabled: true } };
  const effective = mergeWebsiteConfig(config, local);
  assert.equal(effective.features?.faqEnabled, false);
  assert.deepEqual(effective.theme, { primary: '#123456' });
  const next = replaceWebsiteImages(local, effective, 'hero', [{ fileId: 'new', url: 'new-photo' }]);
  assert.deepEqual(next.theme, local.theme);
  assert.equal(next.branding?.heroBackgroundUrl, 'background');
  assert.equal(next.branding?.heroImageUrl, 'new-photo');
  assert.equal(next.branding?.heroImage2Url, '');
  assert.equal(config.branding?.heroImageUrl, 'https://images.test/old.jpg');
  assert.equal(mergeWebsiteConfig(config, next).branding?.heroImage2Url, '');
});
test('presentation editing changes only its image and validates count and duplicates', () => {
  const next = replaceWebsiteImages({}, config, 'presentation-0', [{ fileId: 'new', url: 'new-photo' }]);
  assert.deepEqual(next.landing?.presentation?.sections?.[0], { enabled: true, title: 'Our salon', body: 'About us', imageFileId: 'new', imageUrl: 'new-photo' });
  assert.throws(() => replaceWebsiteImages({}, config, 'hero', Array.from({ length: 6 }, (_, i) => ({ fileId: `${i}`, url: `${i}` }))), code('WEBSITE_INVALID'));
  assert.throws(() => replaceWebsiteImages({}, config, 'hero', [{ fileId: 'one', url: 'same' }, { fileId: 'one', url: 'same' }]), code('WEBSITE_INVALID'));
  assert.equal(landingImageReferences(next)[0].fileId, 'new');
});
test('use case retains known URLs but resolves every new upload from the trusted provider', async () => {
  const calls: unknown[] = [];
  const port: WebsiteMediaPort = {
    read: async () => ({ revision: 'v1', sections: websiteImageSections(config) }),
    resolve: async (...args) => { calls.push(args); return { fileId: 'new', url: 'trusted-url' }; },
    save: async (...args) => { calls.push(args); return { revision: 'v2', sections: [] }; }, discard: async () => {},
  };
  const useCase = new ManageWebsiteImagesUseCase(port);
  await useCase.replace(context, 'v1', 'hero', [{ fileId: 'old' }, { fileId: 'new' }]);
  assert.deepEqual(calls[0], [context, 'new']);
  assert.deepEqual(calls[1], [context, 'v1', 'hero', [{ fileId: 'old', url: 'https://images.test/old.jpg' }, { fileId: 'new', url: 'trusted-url' }]]);
  await assert.rejects(() => useCase.replace(context, 'stale', 'hero', []), code('WEBSITE_CONFLICT'));
  await assert.rejects(() => useCase.replace(context, 'v1', 'hero', [{ existingUrl: 'https://attacker.test/image.jpg' }]), code('WEBSITE_INVALID'));
  await assert.rejects(() => useCase.replace(context, 'v1', 'not-a-section', []), code('WEBSITE_SECTION_DISABLED'));
  await assert.rejects(() => useCase.discard(context, '../foreign'), code('WEBSITE_INVALID'));
});
