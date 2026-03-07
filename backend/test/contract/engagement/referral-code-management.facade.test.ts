import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReferralCodeService } from '@/modules/referrals/referral-code.service';
import { EngagementReferralCodeManagementPort } from '@/contexts/engagement/ports/outbound/referral-code-management.port';

const basePort = (): EngagementReferralCodeManagementPort => ({
  getOrCreateCode: async (userId) => ({
    id: 'code-1',
    localId: 'loc-1',
    userId,
    code: 'ABC123',
    isActive: true,
  }),
  resolveCode: async (code) => ({
    id: 'code-1',
    localId: 'loc-1',
    userId: 'user-1',
    code,
    isActive: true,
    user: {
      id: 'user-1',
      name: 'Carlos',
      email: 'carlos@test.dev',
      phone: null,
    },
  }),
});

test('referral code facade delegates getOrCreateCode', async () => {
  const calls: string[] = [];
  const service = new ReferralCodeService({
    ...basePort(),
    getOrCreateCode: async (userId) => {
      calls.push(userId);
      return {
        id: 'code-2',
        localId: 'loc-1',
        userId,
        code: 'ZXCVBN',
        isActive: true,
      };
    },
  });

  const result = await service.getOrCreateCode('user-99');

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'user-99');
  assert.equal(result.code, 'ZXCVBN');
});

test('referral code facade delegates resolveCode', async () => {
  const calls: string[] = [];
  const service = new ReferralCodeService({
    ...basePort(),
    resolveCode: async (code) => {
      calls.push(code);
      return {
        id: 'code-3',
        localId: 'loc-1',
        userId: 'user-1',
        code,
        isActive: true,
        user: {
          id: 'user-1',
          name: 'Carlos',
          email: 'carlos@test.dev',
          phone: '+34123123',
        },
      };
    },
  });

  const result = await service.resolveCode('HELLO1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'HELLO1');
  assert.equal(result.code, 'HELLO1');
});
