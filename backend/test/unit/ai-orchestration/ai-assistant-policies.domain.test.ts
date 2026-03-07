import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  detectForcedToolFromAssistantPrompt,
  isLikelyAiToolActionMessage,
  isSingleHolidayRangeIntent,
} from '@/contexts/ai-orchestration/domain/services/assistant-intent-policy';
import {
  buildAlertResponseMessage,
  buildCreateAppointmentFallbackMessage,
  buildHolidayResponseMessage,
  sanitizeAssistantMessage,
} from '@/contexts/ai-orchestration/domain/services/assistant-response-policy';

test('detectForcedToolFromAssistantPrompt infers appointment follow-up', () => {
  const tool = detectForcedToolFromAssistantPrompt('Necesito la hora exacta para crear la cita.');
  assert.equal(tool, 'create_appointment');
});

test('isLikelyAiToolActionMessage detects action request and skips question-like text', () => {
  assert.equal(isLikelyAiToolActionMessage('crea una cita mañana por la tarde'), true);
  assert.equal(isLikelyAiToolActionMessage('¿puedes crear una cita mañana?'), false);
});

test('isSingleHolidayRangeIntent enforces one holiday range when intent is singular', () => {
  assert.equal(isSingleHolidayRangeIntent('crea un cierre desde el 2026-03-10 hasta el 2026-03-12'), true);
  assert.equal(isSingleHolidayRangeIntent('cierra del 2026-03-10 al 2026-03-12 y otro después'), false);
});

test('buildCreateAppointmentFallbackMessage returns created summary', () => {
  const message = buildCreateAppointmentFallbackMessage(
    {
      status: 'created',
      startDateTime: '2026-03-05T09:30:00.000Z',
      serviceName: 'Corte',
      barberName: 'Mario',
      clientName: 'Carlos',
      userType: 'registered',
    },
    'UTC',
  );
  assert.match(message || '', /Cita creada\./);
  assert.match(message || '', /Servicio: Corte\./);
});

test('buildHolidayResponseMessage and buildAlertResponseMessage return expected strings', () => {
  const holiday = buildHolidayResponseMessage({
    status: 'added',
    scope: 'shop',
    range: { start: '2026-03-10', end: '2026-03-12' },
  });
  assert.equal(holiday, 'Festivo creado para el local del 2026-03-10 al 2026-03-12.');

  const alert = buildAlertResponseMessage({
    status: 'created',
    title: 'Cierre temporal',
  });
  assert.equal(alert, 'Alerta creada. Cierre temporal');
});

test('sanitizeAssistantMessage strips formatting and unsupported recommendation blocks', () => {
  const message = sanitizeAssistantMessage(
    'Texto inicial.\nRecomendación:\n- item 1\n- item 2\n\n**Respuesta** final.',
  );
  assert.equal(message, 'Texto inicial.\nRespuesta final.');
});
