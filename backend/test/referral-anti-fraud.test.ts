import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReferralAttributionService } from '../src/modules/referrals/referral-attribution.service';
import { runWithTenantContextAsync } from '../src/tenancy/tenant.context';

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

  return new ReferralAttributionService(
    prisma,
    configService,
    codeService,
    rewardsService,
    notificationsService,
  );
};

test('rejects self referral by user id', async () => {
  const service = buildService();
  await assert.rejects(
    () =>
      runWithTenantContextAsync({ localId: 'local-1' }, () =>
        service.attributeReferral({ code: 'ABC', channel: 'link', userId: 'user-1' }),
      ),
    { message: 'No puedes auto-referirte.' },
  );
});

test('rejects self referral by contact', async () => {
  const service = buildService();
  await assert.rejects(
    () =>
      runWithTenantContextAsync({ localId: 'local-1' }, () =>
        service.attributeReferral({ code: 'ABC', channel: 'link', referredEmail: 'referrer@example.com' }),
      ),
    { message: 'No puedes auto-referirte.' },
  );
});

test('rejects duplicate referrals by contact', async () => {
  const service = buildService({ duplicate: true });
  await assert.rejects(
    () =>
      runWithTenantContextAsync({ localId: 'local-1' }, () =>
        service.attributeReferral({ code: 'ABC', channel: 'link', referredEmail: 'guest@example.com' }),
      ),
    { message: 'Este referido ya está registrado.' },
  );
});
