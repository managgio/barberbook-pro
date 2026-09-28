import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSettings } from '@/modules/settings/settings.types';

test('site settings keep phone-required disabled by default', () => {
  const settings = normalizeSettings();
  assert.equal(settings.profile.phoneRequired, false);
});

test('site settings allow enabling phone-required policy', () => {
  const settings = normalizeSettings({
    profile: { phoneRequired: true },
  });
  assert.equal(settings.profile.phoneRequired, true);
});

test('site settings keep public service descriptions disabled by default', () => {
  const settings = normalizeSettings();
  assert.equal(settings.services.showDescriptions, false);
});

test('site settings allow enabling public service descriptions per location', () => {
  const settings = normalizeSettings({
    services: {
      categoriesEnabled: false,
      barberServiceAssignmentEnabled: false,
      showDescriptions: true,
    },
  });
  assert.equal(settings.services.showDescriptions, true);
});

test('site settings preserve extraordinary openings inside the location schedule', () => {
  const settings = normalizeSettings({
    openingHours: {
      ...normalizeSettings().openingHours,
      extraordinaryOpenings: {
        '2026-10-05': {
          name: 'Apertura especial',
          allProfessionals: false,
          barberIds: ['barber-1'],
          morning: { enabled: true, start: '10:00', end: '14:00' },
          afternoon: { enabled: false, start: '00:00', end: '00:00' },
        },
      },
    },
  });

  assert.deepEqual(settings.openingHours.extraordinaryOpenings, {
    '2026-10-05': {
      name: 'Apertura especial',
      allProfessionals: false,
      barberIds: ['barber-1'],
      morning: { enabled: true, start: '10:00', end: '14:00' },
      afternoon: { enabled: false, start: '00:00', end: '00:00' },
    },
  });
});
