import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SettingsTenantNotificationManagementAdapter } from '@/modules/notifications/adapters/settings-tenant-notification-management.adapter';
import { DEFAULT_SITE_SETTINGS } from '@/modules/settings/settings.types';

test('appointment email uses app timezone when formatting date/time', async () => {
  const sentMails: Array<{ text: string }> = [];
  const settingsService = {
    getSettings: async () => DEFAULT_SITE_SETTINGS,
  } as any;
  const tenantConfig = {
    getEffectiveConfig: async () => ({
      notificationPrefs: { email: true },
      email: {
        user: 'sender@example.com',
        password: 'secret',
        fromName: 'Le Blond',
      },
      branding: {
        name: 'Le Blond Hair Salon',
        shortName: 'Le Blond',
      },
    }),
  } as any;
  const usageMetrics = {
    recordTwilioUsage: async () => undefined,
  } as any;
  const emailTransportFactory = {
    createTransport: () => ({
      sendMail: async (payload: { text: string }) => {
        sentMails.push(payload);
      },
    }),
  } as any;
  const twilioClientFactory = {
    createClient: () => ({
      messages: {
        create: async () => ({ sid: 'SM_TEST', price: null, priceUnit: null }),
      },
    }),
  } as any;
  const tenantContextPort = {
    getRequestContext: () => ({
      tenantId: 'tenant-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-1',
    }),
  } as any;

  const adapter = new SettingsTenantNotificationManagementAdapter(
    settingsService,
    tenantConfig,
    usageMetrics,
    emailTransportFactory,
    twilioClientFactory,
    tenantContextPort,
  );

  await adapter.sendAppointmentEmail(
    { email: 'cliente@example.com', name: 'Cliente' },
    { date: new Date('2026-07-01T09:00:00.000Z'), serviceName: 'Corte' },
    'creada',
  );

  assert.equal(sentMails.length, 1);
  assert.match(sentMails[0].text, /11:00/);
  assert.doesNotMatch(sentMails[0].text, /09:00/);
});
