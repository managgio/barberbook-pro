import { expect, it } from 'vitest';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import { buildSettingsSectionPayload, mergeSettingsDraft, settingsWithDraftPhone } from './settingsSections';

const settings = () => structuredClone(DEFAULT_SITE_SETTINGS);

it('saves landing fields without submitting pending operations or agenda changes', () => {
  const saved = settings();
  const draft = settings();
  draft.branding.name = 'Nuevo nombre';
  draft.socials.instagram = '  negocio  ';
  draft.appointments.cancellationCutoffHours = 24;
  draft.products.showOnLanding = !saved.products.showOnLanding;
  draft.openingHours.bufferMinutes = 15;
  const payload = buildSettingsSectionPayload(saved, draft, 'identity');
  expect(payload.branding.name).toBe('Nuevo nombre');
  expect(payload.socials.instagram).toBe('negocio');
  expect(payload.appointments).toEqual(saved.appointments);
  expect(payload.products).toEqual(saved.products);
  expect(payload.openingHours).toEqual(saved.openingHours);
  expect(draft.socials.instagram).toBe('  negocio  ');
});

it('saves operations without submitting landing changes or changing platform capabilities', () => {
  const saved = settings();
  const draft = settingsWithDraftPhone(settings(), '600 123 456');
  draft.branding.name = 'Nombre pendiente';
  draft.appointments.cancellationCutoffHours = 24;
  draft.products.clientPurchaseEnabled = !saved.products.clientPurchaseEnabled;
  draft.products.enabled = !saved.products.enabled;
  draft.services.showDescriptions = !saved.services.showDescriptions;
  const payload = buildSettingsSectionPayload(saved, draft, 'operations');
  expect(payload.contact).toEqual(saved.contact);
  expect(payload.branding).toEqual(saved.branding);
  expect(payload.appointments.cancellationCutoffHours).toBe(24);
  expect(payload.products.clientPurchaseEnabled).toBe(draft.products.clientPurchaseEnabled);
  expect(payload.products.enabled).toBe(saved.products.enabled);
  expect(payload.services).toEqual(saved.services);
});

it('keeps other drafts and edits made during saving when merging the server response', () => {
  const previous = settings();
  const submitted = settings();
  submitted.appointments.cancellationCutoffHours = 12;
  const current = structuredClone(submitted);
  current.appointments.cancellationCutoffHours = 18;
  current.branding.name = 'Sin publicar';
  const response = structuredClone(submitted);
  response.services.showDescriptions = !previous.services.showDescriptions;
  const merged = mergeSettingsDraft(current, submitted, response);
  expect(merged.appointments.cancellationCutoffHours).toBe(18);
  expect(merged.branding.name).toBe('Sin publicar');
  expect(merged.services).toEqual(response.services);
});
