import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformSmsTestService } from '@/modules/notifications/platform-sms-test.service';

test('platform SMS test is available locally and bypasses the routine-delivery block explicitly', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const commands: Array<Record<string, unknown>> = [];
  const service = new PlatformSmsTestService({
    send: async (command: Record<string, unknown>) => {
      commands.push(command);
      return { status: 'accepted', providerMessageId: 'SM_LOCAL_TEST' };
    },
  } as any);

  try {
    const result = await service.send('600 111 222', null, 'localhost', '127.0.0.1');
    assert.deepEqual(result, { success: true, providerMessageId: 'SM_LOCAL_TEST' });
    assert.deepEqual(commands, [{
      to: '+34600111222',
      body: 'MANAGGIO: SMS de prueba local.',
      purpose: 'platform_test',
    }]);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('platform SMS test is rejected outside local without invoking the gateway', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let calls = 0;
  const service = new PlatformSmsTestService({
    send: async () => {
      calls += 1;
      return { status: 'accepted', providerMessageId: 'SM_NEVER' };
    },
  } as any);

  try {
    await assert.rejects(
      () => service.send('+34600111222', null, 'localhost', '127.0.0.1'),
      (error: any) => {
      assert.equal(error.status, 403);
      return true;
      },
    );
    assert.equal(calls, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('platform SMS test rejects messages above the global segment ceiling', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let calls = 0;
  const service = new PlatformSmsTestService({
    send: async () => {
      calls += 1;
      return { status: 'accepted', providerMessageId: 'SM_NEVER' };
    },
  } as any);

  try {
    await assert.rejects(() => service.send('+34600111222', 'á'.repeat(202), '127.0.0.1', '::1'), (error: any) => {
      assert.equal(error.status, 400);
      assert.equal(error.response.code, 'SMS_MESSAGE_TOO_LONG');
      return true;
    });
    assert.equal(calls, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('platform SMS test rejects a non-local request host even in development', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let calls = 0;
  const service = new PlatformSmsTestService({
    send: async () => {
      calls += 1;
      return { status: 'accepted', providerMessageId: 'SM_NEVER' };
    },
  } as any);

  try {
    await assert.rejects(
      () => service.send('+34600111222', null, 'platform.managgio.com', '127.0.0.1'),
      (error: any) => {
        assert.equal(error.status, 403);
        assert.equal(error.response.code, 'SMS_TEST_LOCAL_ONLY');
        return true;
      },
    );
    assert.equal(calls, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('platform SMS test rejects a spoofed localhost Host from a remote peer', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let calls = 0;
  const service = new PlatformSmsTestService({
    send: async () => {
      calls += 1;
      return { status: 'accepted', providerMessageId: 'SM_NEVER' };
    },
  } as any);

  try {
    await assert.rejects(
      () => service.send('+34600111222', null, 'localhost', '203.0.113.10'),
      (error: any) => {
        assert.equal(error.status, 403);
        assert.equal(error.response.code, 'SMS_TEST_LOCAL_ONLY');
        return true;
      },
    );
    assert.equal(calls, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('platform SMS test rate limits repeated local attempts before invoking the gateway twice', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let calls = 0;
  const service = new PlatformSmsTestService({
    send: async () => {
      calls += 1;
      return { status: 'accepted', providerMessageId: `SM_LOCAL_${calls}` };
    },
  } as any);

  try {
    await service.send('+34600111222', null, 'localhost', '127.0.0.1');
    await assert.rejects(
      () => service.send('+34600111222', null, 'localhost', '127.0.0.1'),
      (error: any) => {
        assert.equal(error.status, 429);
        assert.equal(error.response.code, 'SMS_TEST_COOLDOWN');
        assert.ok(error.response.retryAfterSeconds >= 1);
        return true;
      },
    );
    assert.equal(calls, 1);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
