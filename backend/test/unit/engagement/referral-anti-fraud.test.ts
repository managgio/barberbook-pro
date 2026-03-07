import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaReferralAttributionManagementAdapter } from '@/modules/referrals/adapters/prisma-referral-attribution-management.adapter';
import { ReferralChannel } from '@/modules/referrals/dto/attribute-referral.dto';
import { runWithTenantContextAsync } from '@/tenancy/tenant.context';

const buildService = (options?: { duplicate?: boolean }) => {
  const prisma = {
    referralAttribution: {
      findFirst: async () => (options?.duplicate ? { id: 'attr-1' } : null),
      create: async () => ({
        id: 'attr-1',
        expiresAt: new Date(),
      }),
    },
    appointment: {
      findFirst: async () => null,
    },
  } as any;

  const configService = {
    getConfig: async () => ({
      enabled: true,
      attributionExpiryDays: 30,
      newCustomerOnly: false,
      antiFraud: {
        blockSelfByUser: true,
        blockSelfByContact: true,
        blockDuplicateContact: true,
      },
    }),
    isModuleEnabled: async () => true,
  } as any;

  const codeService = {
    resolveCode: async () => ({
      id: 'code-1',
      localId: 'local-1',
      userId: 'user-1',
      user: {
        name: 'Referrer',
        email: 'referrer@example.com',
        phone: '+34123456789',
      },
    }),
  } as any;

  const rewardsService = {} as any;
  const notificationsService = {} as any;
  const subscriptionsService = {
    hasUsableActiveSubscription: async () => false,
  } as any;
  const tenantContextPort = {
    getRequestContext: () => ({
      tenantId: 'brand-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'test-correlation-id',
    }),
  } as any;

  return new PrismaReferralAttributionManagementAdapter(
    prisma,
    configService,
    codeService,
    rewardsService,
    notificationsService,
    subscriptionsService,
    tenantContextPort,
  );
};

test('rejects self referral by user id', async () => {
  const service = buildService();
  await assert.rejects(
    () =>
      runWithTenantContextAsync({ localId: 'local-1' }, () =>
        service.attributeReferral({ code: 'ABC', channel: ReferralChannel.link, userId: 'user-1' }),
      ),
    { message: 'No puedes auto-referirte.' },
  );
});

test('rejects self referral by contact', async () => {
  const service = buildService();
  await assert.rejects(
    () =>
      runWithTenantContextAsync({ localId: 'local-1' }, () =>
        service.attributeReferral({
          code: 'ABC',
          channel: ReferralChannel.link,
          referredEmail: 'referrer@example.com',
        }),
      ),
    { message: 'No puedes auto-referirte.' },
  );
});

test('rejects duplicate referrals by contact', async () => {
  const service = buildService({ duplicate: true });
  await assert.rejects(
    () =>
      runWithTenantContextAsync({ localId: 'local-1' }, () =>
        service.attributeReferral({
          code: 'ABC',
          channel: ReferralChannel.link,
          referredEmail: 'guest@example.com',
        }),
      ),
    { message: 'Este referido ya está registrado.' },
  );
});
