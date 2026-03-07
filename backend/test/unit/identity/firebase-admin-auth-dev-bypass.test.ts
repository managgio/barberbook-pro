import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { FirebaseAdminService } from '@/modules/firebase/firebase-admin.service';

const buildService = () =>
  new FirebaseAdminService(
    {
      getBrandConfig: async () => ({ firebaseAdmin: null }),
    } as any,
    {
      getRequestContext: () => ({ brandId: 'brand-local', localId: 'local-local' }),
    } as any,
  );

test('firebase admin service resolves local dev bypass token when enabled', async () => {
  const previousBypass = process.env.AUTH_DEV_BYPASS_ENABLED;
  const previousPrefix = process.env.AUTH_DEV_BYPASS_PREFIX;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.AUTH_DEV_BYPASS_ENABLED = 'true';
  process.env.AUTH_DEV_BYPASS_PREFIX = 'dev:';
  process.env.NODE_ENV = 'test';

  try {
    const service = buildService();
    const decoded = await service.verifyIdToken('dev:firebase-user-1');
    assert.ok(decoded);
    assert.equal(decoded?.uid, 'firebase-user-1');
  } finally {
    process.env.AUTH_DEV_BYPASS_ENABLED = previousBypass;
    process.env.AUTH_DEV_BYPASS_PREFIX = previousPrefix;
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test('firebase admin service keeps bypass disabled by default', async () => {
  const previousBypass = process.env.AUTH_DEV_BYPASS_ENABLED;
  const previousPrefix = process.env.AUTH_DEV_BYPASS_PREFIX;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.AUTH_DEV_BYPASS_ENABLED;
  delete process.env.AUTH_DEV_BYPASS_PREFIX;
  process.env.NODE_ENV = 'test';

  try {
    const service = buildService();
    const decoded = await service.verifyIdToken('dev:firebase-user-2');
    assert.equal(decoded, null);
  } finally {
    process.env.AUTH_DEV_BYPASS_ENABLED = previousBypass;
    process.env.AUTH_DEV_BYPASS_PREFIX = previousPrefix;
    process.env.NODE_ENV = previousNodeEnv;
  }
});
