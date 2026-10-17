import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getTenantEmailLogoAttachments,
  renderBrandedEmail,
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

test('tenant email branding follows light mode and selects the light-mode logo', () => {
  const branding = resolveTenantEmailBranding({
    branding: {
      logoLightUrl: 'https://cdn.example.com/logo-light.png',
      logoDarkUrl: 'https://cdn.example.com/logo-dark.png',
    },
    theme: { mode: 'light', primary: '#c03d68' },
  });

  assert.equal(branding.mode, 'light');
  assert.equal(branding.background, '#f2f4f7');
  assert.equal(branding.cardBackground, '#ffffff');
  assert.equal(branding.logo?.src, 'https://cdn.example.com/logo-light.png');

  const html = renderBrandedEmail({
    branding,
    brandName: 'Tenant',
    eyebrow: 'Cita creada',
    bodyHtml: '<p>Contenido</p>',
    footerText: 'Footer',
  });
  assert.match(html, /name="color-scheme" content="light"/);
  assert.match(html, /background:#f2f4f7/);
  assert.match(html, /color:#18212b/);
});

test('tenant email branding keeps dark mode as the safe default', () => {
  const branding = resolveTenantEmailBranding({ theme: { primary: '#d4af37' } });
  assert.equal(branding.mode, 'dark');
  assert.equal(branding.background, '#0f0f12');
  assert.equal(branding.textColor, '#f8fafc');
});
