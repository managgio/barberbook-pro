import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SettingsTenantNotificationManagementAdapter } from '@/modules/notifications/adapters/settings-tenant-notification-management.adapter';
import { DEFAULT_SITE_SETTINGS } from '@/modules/settings/settings.types';
import {
  describeEmailDeliveryError,
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
        host: 'smtp.example.com',
        port: 587,
        fromName: 'Le Blond',
      },
      branding: {
        name: 'Le Blond Hair Salon',
        shortName: 'Le Blond',
      },
    }),
  } as any;
  const usageMetrics = {
    recordSmsUsage: async () => undefined,
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
    {} as any,
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

test('all HTML email templates use the effective tenant color and embedded tenant logo', async () => {
  const sentMails: Array<{
    html: string;
    attachments?: Array<{
      filename: string;
      path: string;
      contentType?: string;
      cid?: string;
    }>;
  }> = [];
  const logoUrl = 'https://ik.imagekit.io/managgio/brands/ronin/logo.png';
  const settingsService = {
    getSettings: async () => ({
      ...DEFAULT_SITE_SETTINGS,
      branding: {
        ...DEFAULT_SITE_SETTINGS.branding,
        name: 'Ronin Blade & Brush',
        shortName: 'Ronin',
      },
    }),
  } as any;
  const tenantConfig = {
    getEffectiveConfig: async () => ({
      notificationPrefs: { email: true },
      email: {
        user: 'sender@example.com',
        password: 'secret',
        host: 'smtp.example.com',
        port: 587,
        fromName: 'Ronin',
      },
      branding: {
        name: 'Ronin Blade & Brush',
        shortName: 'Ronin',
        logoDarkUrl: logoUrl,
      },
      theme: { primary: '#d4af37', mode: 'dark' },
      imagekit: { urlEndpoint: 'https://ik.imagekit.io/managgio' },
    }),
  } as any;
  const adapter = new SettingsTenantNotificationManagementAdapter(
    settingsService,
    tenantConfig,
    { recordSmsUsage: async () => undefined } as any,
    {
      createTransport: () => ({
        sendMail: async (payload: typeof sentMails[number]) => {
          sentMails.push(payload);
        },
      }),
    } as any,
    {} as any,
    {} as any,
    {
      getRequestContext: () => ({ brandId: 'brand-ronin', localId: 'local-ronin' }),
    } as any,
  );

  await adapter.sendAppointmentEmail(
    { email: 'client@example.com', name: 'Cliente' },
    { date: new Date('2026-10-05T13:30:00.000Z'), serviceName: 'Corte' },
    'creada',
  );
  await adapter.sendReferralRewardEmail({
    contact: { email: 'client@example.com', name: 'Cliente' },
    title: 'Recompensa',
    message: 'Tienes una recompensa',
    ctaUrl: 'https://ronin.managgio.com',
  });
  await adapter.sendBroadcastEmail({
    contact: { email: 'client@example.com', name: 'Cliente' },
    subject: 'Comunicado',
    message: 'Mensaje de Ronin',
  });

  assert.equal(sentMails.length, 3);
  sentMails.forEach((mail) => {
    assert.match(mail.html, /cid:tenant-brand-logo/);
    assert.match(mail.html, /#d4af37/);
    assert.doesNotMatch(mail.html, /#f472b6/);
    assert.deepEqual(mail.attachments, [{
      filename: 'tenant-brand-logo.png',
      path: `${logoUrl}?tr=w-160%2Cf-png%2Cq-90`,
      contentType: 'image/png',
      cid: 'tenant-brand-logo',
    }]);
  });
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
    {} as any,
    {
      getRequestContext: () => ({ brandId: 'brand-1', localId }),
    } as any,
  );

  await (adapter as any).getTransporter({ user: 'sender@example.com', password, host: 'smtp.example.com', port: 587 });
  await (adapter as any).getTransporter({ user: 'sender@example.com', password, host: 'smtp.example.com', port: 587 });
  password = 'secret-2';
  await (adapter as any).getTransporter({ user: 'sender@example.com', password, host: 'smtp.example.com', port: 587 });
  localId = 'local-2';
  await (adapter as any).getTransporter({ user: 'sender@example.com', password, host: 'smtp.example.com', port: 587 });

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
        email: { user: 'sender@example.com', password: 'secret', host: 'smtp.example.com', port: 587 },
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

test('invalid Gmail app password configuration fails without contacting SMTP', async () => {
  let transportCreations = 0;
  const adapter = new SettingsTenantNotificationManagementAdapter(
    { getSettings: async () => DEFAULT_SITE_SETTINGS } as any,
    {
      getEffectiveConfig: async () => ({
        notificationPrefs: { email: true },
        email: {
          user: 'sender@gmail.com',
          password: 'abcd efgh ijkl mnop qr',
          host: 'smtp.gmail.com',
          port: 587,
        },
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
    {} as any,
    { getRequestContext: () => ({ brandId: 'brand-ronin', localId: 'local-ronin' }) } as any,
  );

  const result = await adapter.sendBroadcastEmail({
    contact: { email: 'client@example.com' },
    subject: 'Aviso',
    message: 'Mensaje',
  });

  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.code, 'SMTP_GOOGLE_APP_PASSWORD_INVALID');
    assert.equal(result.retryable, false);
    assert.equal(result.critical, true);
  }
  assert.equal(transportCreations, 0);
});

test('routine SMS is skipped locally without invoking the provider gateway', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let gatewayCalls = 0;
  const adapter = new SettingsTenantNotificationManagementAdapter(
    { getSettings: async () => DEFAULT_SITE_SETTINGS } as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { sms: true } }) } as any,
    { recordSmsUsage: async () => undefined } as any,
    {} as any,
    { send: async () => {
      gatewayCalls += 1;
      return { status: 'accepted', providerMessageId: 'SM_FORBIDDEN' };
    } } as any,
    {} as any,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
  );

  try {
    const result = await adapter.sendBroadcastSms({
      contact: { phone: '+34600111222' },
      message: 'No debe enviarse',
    });

    assert.equal(result.status, 'skipped');
    if (result.status === 'skipped') assert.equal(result.code, 'SMS_ROUTINE_DELIVERY_DISABLED');
    assert.equal(gatewayCalls, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('production SMS uses the provider-neutral gateway and preserves the outbox delivery reference', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const gatewayCalls: Array<Record<string, unknown>> = [];
  const usageCalls: Array<Record<string, unknown>> = [];
  const settings = {
    ...DEFAULT_SITE_SETTINGS,
    branding: { ...DEFAULT_SITE_SETTINGS.branding, name: 'Ronin Blade & Brush', shortName: 'Ronin' },
  };
  const adapter = new SettingsTenantNotificationManagementAdapter(
    { getSettings: async () => settings } as any,
    {
      getEffectiveConfig: async () => ({
        notificationPrefs: { sms: true },
        branding: { name: 'Ronin Blade & Brush', shortName: 'Ronin' },
        twilio: { smsSenderId: 'TENANT-SENDER-IS-IGNORED' },
      }),
    } as any,
    { recordSmsUsage: async (value: Record<string, unknown>) => usageCalls.push(value) } as any,
    {} as any,
    {
      send: async (command: Record<string, unknown>) => {
        gatewayCalls.push(command);
        return {
          status: 'accepted',
          providerMessageId: 'SM_123',
          cost: { amount: 0.08, currency: 'USD' },
        };
      },
    } as any,
    {} as any,
    {
      getRequestContext: () => ({
        brandId: 'brand-ronin',
        localId: 'local-ronin',
        timezone: 'America/New_York',
      }),
    } as any,
  );

  try {
    const result = await adapter.sendReminderSms(
      { phone: '600 111 222', name: 'Cliente' },
      { date: new Date('2026-10-18T08:00:00.000Z'), serviceName: 'Corte + Barba' },
      { deliveryAttemptReference: 'attempt-reference-123' },
    );

    assert.equal(result.status, 'accepted');
    assert.deepEqual(gatewayCalls, [{
      to: '+34600111222',
      body: gatewayCalls[0].body,
      purpose: 'routine',
      deliveryReference: 'attempt-reference-123',
    }]);
    assert.match(String(gatewayCalls[0].body), /^Ronin: recuerda tu cita/);
    assert.match(String(gatewayCalls[0].body), /18\/10 a las 04:00/);
    assert.match(String(gatewayCalls[0].body), /Corte \+ Barba/);
    assert.deepEqual(usageCalls, [{ costUsd: 0.08, messages: 1 }]);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('WhatsApp delivery also crosses a provider-neutral gateway', async () => {
  const commands: Array<Record<string, any>> = [];
  const usageCalls: Array<Record<string, unknown>> = [];
  const settings = {
    ...DEFAULT_SITE_SETTINGS,
    branding: { ...DEFAULT_SITE_SETTINGS.branding, name: 'Ronin Blade & Brush', shortName: 'Ronin' },
  };
  const adapter = new SettingsTenantNotificationManagementAdapter(
    { getSettings: async () => settings } as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { whatsapp: true } }) } as any,
    { recordWhatsappUsage: async (value: Record<string, unknown>) => usageCalls.push(value) } as any,
    {} as any,
    {} as any,
    {
      send: async (command: Record<string, any>) => {
        commands.push(command);
        return {
          status: 'accepted',
          providerMessageId: 'WA_123',
          cost: { amount: 0.04, currency: 'USD' },
        };
      },
    } as any,
    { getRequestContext: () => ({ brandId: 'brand-ronin', localId: 'local-ronin' }) } as any,
  );

  const result = await adapter.sendReminderWhatsapp(
    { phone: '600 111 222', name: 'Cliente' },
    { date: new Date('2026-10-18T08:00:00.000Z'), serviceName: 'Corte + Barba' },
  );

  assert.equal(result.status, 'accepted');
  assert.equal(commands[0].to, '+34600111222');
  assert.equal(commands[0].templateData.brand, 'Ronin');
  assert.equal(commands[0].templateData.name, 'Cliente');
  assert.deepEqual(usageCalls, [{ costUsd: 0.04, messages: 1 }]);
});

test('production broadcast SMS rejects more than three segments before invoking the gateway', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let gatewayCalls = 0;
  const adapter = new SettingsTenantNotificationManagementAdapter(
    {} as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { sms: true } }) } as any,
    {} as any,
    {} as any,
    {
      send: async () => {
        gatewayCalls += 1;
        return { status: 'accepted', providerMessageId: 'SM_NEVER' };
      },
    } as any,
    {} as any,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
  );

  try {
    const result = await adapter.sendBroadcastSms({
      contact: { phone: '+34600111222' },
      message: 'á'.repeat(202),
    });
    assert.equal(result.status, 'failed');
    if (result.status === 'failed') {
      assert.equal(result.code, 'SMS_MESSAGE_TOO_LONG');
      assert.equal(result.retryable, false);
      assert.equal(result.critical, false);
    }
    assert.equal(gatewayCalls, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
