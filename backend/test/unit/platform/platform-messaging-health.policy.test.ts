import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolvePlatformMessagingHealth } from '@/modules/platform-admin/platform-messaging-health.policy';

const ready = {
  smsEnabled: true,
  whatsappEnabled: true,
  smsRoutineAllowed: true,
  smsGatewayReady: true,
  whatsappGatewayReady: true,
  smsSenderId: 'MANAGGIO',
};

test('platform messaging health is provider-neutral and healthy when both gateways are ready', () => {
  const result = resolvePlatformMessagingHealth(ready);

  assert.equal(result.key, 'messaging');
  assert.equal(result.status, 'ok');
  assert.equal(result.summary, 'Mensajería configurada');
  assert.deepEqual(result.details, [
    'Gateway SMS listo; remitente esperado MANAGGIO pendiente de smoke test',
    'WhatsApp global disponible',
  ]);
  assert.doesNotMatch(JSON.stringify(result), /twilio/i);
});

test('platform messaging health reports disabled when the tenant has no messaging channel enabled', () => {
  const result = resolvePlatformMessagingHealth({
    ...ready,
    smsEnabled: false,
    whatsappEnabled: false,
  });

  assert.deepEqual(result, {
    key: 'messaging',
    status: 'disabled',
    summary: 'SMS y WhatsApp desactivados',
    details: [],
  });
});

test('platform messaging health fails closed when an enabled gateway is not ready', () => {
  const result = resolvePlatformMessagingHealth({
    ...ready,
    smsGatewayReady: false,
  });

  assert.equal(result.status, 'error');
  assert.equal(result.summary, 'Mensajería incompleta');
  assert.ok(result.details.includes('El gateway global de SMS no está listo'));
});

test('platform messaging health distinguishes an environment policy block from missing credentials', () => {
  const result = resolvePlatformMessagingHealth({
    ...ready,
    smsRoutineAllowed: false,
    whatsappEnabled: false,
  });

  assert.equal(result.status, 'warning');
  assert.equal(result.summary, 'Mensajería limitada por entorno');
  assert.deepEqual(result.details, ['El SMS rutinario está bloqueado en este entorno']);
});
