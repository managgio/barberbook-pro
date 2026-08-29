import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SettingsTenantNotificationManagementAdapter } from '@/modules/notifications/adapters/settings-tenant-notification-management.adapter';
import { DEFAULT_SITE_SETTINGS } from '@/modules/settings/settings.types';
import {
  describeEmailDeliveryError,
  describeTwilioDeliveryError,
  maskEmailIdentity,
} from '@/modules/notifications/notification-delivery-diagnostic';

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

test('appointment email keeps a defensive missing-recipient result before SMTP', async () => {
  let transportCreations = 0;
  const adapter = new SettingsTenantNotificationManagementAdapter(
    {} as any,
    {
      getEffectiveConfig: async () => ({
        notificationPrefs: { email: true },
        email: { user: 'sender@example.com', password: 'secret' },
      }),
    } as any,
    {} as any,
    {
      createTransport: () => {
        transportCreations += 1;
        return { sendMail: async () => undefined };
      },
    } as any,
    {} as any,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
  );

  const result = await adapter.sendAppointmentEmail(
    { name: 'Invitado' },
    { date: new Date('2026-07-01T09:00:00.000Z'), serviceName: 'Corte' },
    'creada',
  );

  assert.equal(result.status, 'skipped');
  if (result.status === 'skipped') {
    assert.equal(result.code, 'EMAIL_RECIPIENT_MISSING');
  }
  assert.equal(transportCreations, 0);
});

test('Twilio authentication failures are critical and never expose provider messages', () => {
  const diagnostic = describeTwilioDeliveryError(
    { code: 20003, status: 401, message: 'Authenticate with secret token abc123' },
    'sms',
  );

  assert.equal(diagnostic.code, 'TWILIO_AUTH_FAILED');
  assert.equal(diagnostic.retryable, false);
  assert.equal(diagnostic.critical, true);
  assert.doesNotMatch(diagnostic.safeMessage, /abc123/);
});

test('Twilio opted-out recipients fail without retry or critical promotion', () => {
  const diagnostic = describeTwilioDeliveryError({ code: 21610 }, 'whatsapp');

  assert.equal(diagnostic.code, 'RECIPIENT_OPTED_OUT');
  assert.equal(diagnostic.retryable, false);
  assert.equal(diagnostic.critical, false);
});

test('email transporter cache is isolated by local and refreshed when SMTP credentials change', async () => {
  let localId = 'local-1';
  let password = 'secret-1';
  const createdConfigs: any[] = [];
  const adapter = new SettingsTenantNotificationManagementAdapter(
    {} as any,
    {
      getEffectiveConfig: async () => ({
        email: { user: 'sender@example.com', password, host: 'smtp.example.com', port: 587 },
      }),
    } as any,
    {} as any,
    {
      createTransport: (config: any) => {
        createdConfigs.push(config);
        return { sendMail: async () => undefined };
      },
    } as any,
    {} as any,
    {
      getRequestContext: () => ({ brandId: 'brand-1', localId }),
    } as any,
  );

  await (adapter as any).getTransporter();
  await (adapter as any).getTransporter();
  password = 'secret-2';
  await (adapter as any).getTransporter();
  localId = 'local-2';
  await (adapter as any).getTransporter();

  assert.equal(createdConfigs.length, 3);
  assert.equal(createdConfigs[1].auth.pass, 'secret-2');
});

test('SMTP 535 is classified as sender authentication failure without exposing credentials', () => {
  const diagnostic = describeEmailDeliveryError(
    {
      code: 'EAUTH',
      responseCode: 535,
      message: '535-5.7.8 Username and Password not accepted',
    },
    { host: 'smtp.gmail.com', user: 'sender@example.com' },
  );

  assert.equal(diagnostic.code, 'SMTP_AUTH_FAILED');
  assert.match(diagnostic.safeMessage, /sender credentials or app password/);
  assert.doesNotMatch(diagnostic.safeMessage, /Username and Password not accepted/);
  assert.equal(maskEmailIdentity('sender@example.com'), 's***@example.com');
});

test('SMTP rejected recipients are not reported as accepted deliveries', async () => {
  const adapter = new SettingsTenantNotificationManagementAdapter(
    { getSettings: async () => DEFAULT_SITE_SETTINGS } as any,
    {
      getEffectiveConfig: async () => ({
        notificationPrefs: { email: true },
        email: { user: 'sender@example.com', password: 'secret' },
      }),
    } as any,
    {} as any,
    {
      createTransport: () => ({
        sendMail: async () => ({
          messageId: 'smtp-message-1',
          accepted: [],
          rejected: ['client@example.com'],
        }),
      }),
    } as any,
    {} as any,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
  );

  const result = await adapter.sendBroadcastEmail({
    contact: { email: 'client@example.com' },
    subject: 'Aviso',
    message: 'Mensaje',
  });

  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.code, 'EMAIL_RECIPIENT_REJECTED');
    assert.equal(result.retryable, false);
    assert.equal(result.critical, false);
  }
});
