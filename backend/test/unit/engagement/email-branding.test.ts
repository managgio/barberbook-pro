import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getTenantEmailLogoAttachments,
  resolveTenantEmailBranding,
} from '@/modules/notifications/email-branding';

test('tenant email branding embeds only logos served by the configured ImageKit endpoint', () => {
  const logoUrl = 'https://ik.imagekit.io/managgio/brands/ronin/logo-dark.webp';
  const branding = resolveTenantEmailBranding({
    branding: { logoDarkUrl: logoUrl },
    theme: { primary: '#D4AF37' },
    imagekit: { urlEndpoint: 'https://ik.imagekit.io/managgio' },
  });

  assert.equal(branding.primary, '#d4af37');
  assert.equal(branding.logo?.src, 'cid:tenant-brand-logo');
  assert.deepEqual(getTenantEmailLogoAttachments(branding), [{
    filename: 'tenant-brand-logo.png',
    path: `${logoUrl}?tr=w-160%2Cf-png%2Cq-90`,
    contentType: 'image/png',
    cid: 'tenant-brand-logo',
  }]);
});

test('tenant email branding keeps an external HTTPS logo remote instead of fetching it server-side', () => {
  const branding = resolveTenantEmailBranding({
    branding: { logoUrl: 'https://cdn.example.com/tenant/logo.svg' },
    theme: { primary: '#123456' },
    imagekit: { urlEndpoint: 'https://ik.imagekit.io/managgio' },
  });

  assert.equal(branding.logo?.src, 'https://cdn.example.com/tenant/logo.svg');
  assert.deepEqual(getTenantEmailLogoAttachments(branding), []);
});

test('tenant email branding rejects non-HTTPS logo sources', () => {
  const branding = resolveTenantEmailBranding({
    branding: { logoUrl: 'http://internal.example/logo.png' },
    theme: { primary: '#fff' },
  });

  assert.equal(branding.logo, null);
  assert.equal(branding.primary, '#ffffff');
  assert.ok(branding.accentText.startsWith('#'));
});

test('tenant email branding uses the neutral Managgio color when no tenant color exists', () => {
  const branding = resolveTenantEmailBranding({});

  assert.equal(branding.primary, '#fcbc23');
});
