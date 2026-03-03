import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseDateRangeFromText, parseTimeFromText } from '../src/modules/ai-assistant/ai-assistant.utils';

const NOW = new Date('2026-03-03T10:00:00Z');

test('parseDateRangeFromText resolves mixed range connectors with relative weekday', () => {
  const range = parseDateRangeFromText('crea un festivo para el local desde mañana hasta el martes de la semana que viene', NOW);
  assert.deepEqual(range, {
    start: '2026-03-04',
    end: '2026-03-10',
  });
});

test('parseDateRangeFromText keeps full next-week range when text requests week only', () => {
  const range = parseDateRangeFromText('cierra el local la semana que viene', NOW);
  assert.deepEqual(range, {
    start: '2026-03-09',
    end: '2026-03-15',
  });
});

test('parseTimeFromText handles 12 de la noche as 00:00', () => {
  assert.equal(parseTimeFromText('a las 12 de la noche'), '00:00');
});

test('parseTimeFromText keeps 12 de la tarde as 12:00', () => {
  assert.equal(parseTimeFromText('a las 12 de la tarde'), '12:00');
});
