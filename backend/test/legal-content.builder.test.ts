import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLegalContent } from '../src/modules/legal/legal-content.builder';
import { LegalSettingsResolved } from '../src/modules/legal/legal.types';

const baseSettings: LegalSettingsResolved = {
  brandId: 'brand-1',
  ownerName: 'Salon Demo',
  taxId: 'B12345678',
  address: 'Calle Falsa 123',
  contactEmail: 'legal@salon.test',
  contactPhone: '+34 600 000 000',
  country: 'ES',
  privacyPolicyVersion: 2,
  cookiePolicyVersion: 1,
  legalNoticeVersion: 1,
  aiDisclosureEnabled: true,
  aiProviderNames: ['OpenAI'],
  subProcessors: [
    {
      name: 'OpenAI',
      purpose: 'Asistente IA',
      country: 'EE.UU.',
      dataTypes: 'Mensajes',
      link: 'https://openai.com',
    },
  ],
  optionalCustomSections: {},
  retentionDays: 90,
  updatedAt: new Date('2024-01-01T10:00:00Z'),
};

test('buildLegalContent includes privacy sections and ai disclosure', () => {
  const custom = {
    privacy: [{ heading: 'Extra', bodyMarkdown: 'Texto adicional.' }],
  };
  const content = buildLegalContent('privacy', baseSettings, custom);
  assert.equal(content.version, 2);
  assert.ok(content.sections.length > 0);
  assert.ok(content.sections.some((section) => section.heading === 'Extra'));
  assert.ok(content.aiDisclosure);
  assert.equal(content.aiDisclosure?.providerNames[0], 'OpenAI');
  assert.ok(content.subProcessors && content.subProcessors.length === 1);
});

test('buildLegalContent returns cookie policy without ai disclosure', () => {
  const content = buildLegalContent('cookies', baseSettings, {});
  assert.equal(content.title.toLowerCase(), 'politica de cookies');
  assert.equal(content.version, 1);
  assert.equal(content.aiDisclosure, undefined);
});
