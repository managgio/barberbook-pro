import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSmsReminderMessage,
  toGsm7SafeText,
} from '@/contexts/engagement/domain/services/sms-reminder-message.policy';
import {
  analyzeSmsSegmentation,
  countGsm7Septets,
} from '@/contexts/engagement/domain/services/sms-segmentation.policy';

test('SMS reminder starts with tenant identity and normalizes avoidable Unicode to GSM-7', () => {
  const result = buildSmsReminderMessage({
    brandName: 'Salón José \u2014 Valencia',
    formattedDate: '18/10 a las 10:00',
    serviceName: 'Decoloración + corte',
  });

  assert.match(result.body, /^Salon Jose - Valencia: recuerda tu cita/);
  assert.match(result.body, /Servicios: Decoloracion \+ corte/);
  assert.match(result.body, /No respondas a este SMS\.$/);
  assert.equal(result.encoding, 'GSM-7');
  assert.equal(countGsm7Septets(result.body), result.septets);
  assert.equal(analyzeSmsSegmentation(result.body).segments, result.segments);
  assert.ok(result.segments <= 2);
});

test('SMS reminder keeps CTA and closing while deterministically truncating very long service snapshots', () => {
  const result = buildSmsReminderMessage({
    brandName: 'Le Blond',
    formattedDate: '18/10 a las 10:00',
    serviceName: Array.from({ length: 30 }, (_, index) => `Servicio ${index + 1}`).join(' + '),
    managementUrl: 'https://managgio.com/c/abc123',
  });

  assert.match(result.body, /Servicios: Servicio 1/);
  assert.match(result.body, /\.\.\./);
  assert.match(result.body, /Gestiona tu cita: https:\/\/managgio\.com\/c\/abc123\./);
  assert.match(result.body, /No respondas a este SMS\.$/);
  assert.ok(result.septets <= 306);
  assert.equal(result.segments, 2);
});

test('GSM sanitizer drops unsupported symbols without creating hidden UCS-2 segments', () => {
  const safe = toGsm7SafeText('Cita ✂️ rápida');
  assert.equal(safe, 'Cita rapida');
  assert.notEqual(countGsm7Septets(safe), null);
});
