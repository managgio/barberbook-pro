import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { TenantConfigService } from '@/tenancy/tenant-config.service';
import { EngagementSmsGatewayPort } from '@/contexts/engagement/ports/outbound/sms-gateway.port';
import { EngagementWhatsappGatewayPort } from '@/contexts/engagement/ports/outbound/whatsapp-gateway.port';

const smsGateway = (ready: boolean): EngagementSmsGatewayPort => ({
  isReadyForRoutineDelivery: () => ready,
  send: async () => {
    throw new Error('not used');
  },
});

const whatsappGateway = (ready: boolean): EngagementWhatsappGatewayPort => ({
  isReadyForRoutineDelivery: () => ready,
  send: async () => {
    throw new Error('not used');
  },
});

const createService = (input: { smsReady: boolean; whatsappReady: boolean }) => {
  const prisma = {
    brandConfig: {
      findUnique: async () => ({
        data: {
          notificationPrefs: { email: true, sms: true, whatsapp: true },
        },
      }),
    },
    locationConfig: {
      findUnique: async () => null,
    },
  };
  const context = {
    getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }),
  };

  return new TenantConfigService(
    prisma as never,
    context as never,
    smsGateway(input.smsReady),
    whatsappGateway(input.whatsappReady),
  );
};

test('public notification capabilities use neutral gateway readiness and remain fail-closed', async () => {
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const configured = await createService({ smsReady: true, whatsappReady: true }).getPublicConfig();
    assert.deepEqual(configured.notificationCapabilities, { sms: true, whatsapp: true });

    const smsMissing = await createService({ smsReady: false, whatsappReady: true }).getPublicConfig();
    assert.deepEqual(smsMissing.notificationCapabilities, { sms: false, whatsapp: true });

    const whatsappMissing = await createService({ smsReady: true, whatsappReady: false }).getPublicConfig();
    assert.deepEqual(whatsappMissing.notificationCapabilities, { sms: true, whatsapp: false });
  } finally {
    if (originalEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnvironment;
    }
  }
});

test('public SMS capability stays disabled outside production even when the gateway is ready', async () => {
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';

  try {
    const result = await createService({ smsReady: true, whatsappReady: true }).getPublicConfig();
    assert.deepEqual(result.notificationCapabilities, { sms: false, whatsapp: true });
  } finally {
    if (originalEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnvironment;
    }
  }
});
