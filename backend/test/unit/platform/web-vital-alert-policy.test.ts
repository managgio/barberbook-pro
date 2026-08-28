import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PlatformWebVitalName,
  PlatformWebVitalRating,
} from '@/contexts/platform/domain/entities/platform-observability.entity';
import { buildUrgentWebVitalAlertEmail } from '@/modules/observability/web-vital-alert-email';
import {
  evaluateUrgentWebVitalAlert,
  resolveWebVitalAlertThresholds,
} from '@/modules/observability/web-vital-alert-policy';

const createLcpPayload = (value: number, path = '/app/book') => ({
  name: PlatformWebVitalName.LCP,
  value,
  rating: PlatformWebVitalRating.POOR,
  path,
  timestamp: Date.UTC(2026, 7, 28, 18, 0, 0),
});

test('web vital alert policy keeps poor events below the critical threshold out of email', () => {
  const thresholds = resolveWebVitalAlertThresholds({});

  const decision = evaluateUrgentWebVitalAlert({
    payload: createLcpPayload(7_500),
    thresholds,
  });

  assert.equal(decision.urgent, false);
  assert.equal(decision.threshold.critical, 10_000);
});

test('web vital alert policy marks only values at or above the critical threshold as urgent', () => {
  const thresholds = resolveWebVitalAlertThresholds({});

  assert.equal(evaluateUrgentWebVitalAlert({
    payload: createLcpPayload(10_000),
    thresholds,
  }).urgent, true);
  assert.equal(evaluateUrgentWebVitalAlert({
    payload: createLcpPayload(9_999),
    thresholds,
  }).urgent, false);
});

test('web vital alert policy derives urgency from the server threshold rather than client rating', () => {
  const thresholds = resolveWebVitalAlertThresholds({});

  assert.equal(evaluateUrgentWebVitalAlert({
    payload: {
      ...createLcpPayload(12_000),
      rating: PlatformWebVitalRating.NEEDS_IMPROVEMENT,
    },
    thresholds,
  }).urgent, true);
});

test('web vital alert policy continues excluding platform and in-app browser noise', () => {
  const thresholds = resolveWebVitalAlertThresholds({});

  assert.equal(evaluateUrgentWebVitalAlert({
    payload: createLcpPayload(12_000, '/platform/observability'),
    thresholds,
  }).urgent, false);
  assert.equal(evaluateUrgentWebVitalAlert({
    payload: createLcpPayload(12_000),
    userAgent: 'Instagram 350.0 Mobile',
    thresholds,
  }).urgent, false);
});

test('web vital critical thresholds can be tuned from environment configuration', () => {
  const thresholds = resolveWebVitalAlertThresholds({
    OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_LCP: '12000',
  });

  assert.equal(thresholds.LCP.critical, 12_000);
});

test('urgent web vital email identifies the tenant business at a glance', () => {
  const payload = createLcpPayload(12_000);
  const threshold = resolveWebVitalAlertThresholds({}).LCP;

  const email = buildUrgentWebVitalAlertEmail({
    payload,
    threshold,
    tenant: {
      brandId: 'brand-1',
      brandName: 'Le Blond',
      includeLocal: true,
      localId: 'local-1',
      localName: 'Centro',
    },
    runtimeEnvironment: 'prod',
    timestamp: payload.timestamp,
    userAgent: 'Browser test',
    cooldownMinutes: 360,
  });

  assert.match(email.subject, /\[CRITICAL\]\[PROD\]\[Web Vitals\]\[Le Blond · Centro\]/);
  assert.equal(email.lines[2], 'Negocio / tenant: Le Blond');
  assert.equal(email.lines[3], 'Local: Centro');
  assert.ok(email.lines.includes('Brand ID: brand-1'));
  assert.ok(email.lines.includes('Local ID: local-1'));
});

test('urgent web vital email omits location details for a single active location', () => {
  const payload = createLcpPayload(12_000);
  const threshold = resolveWebVitalAlertThresholds({}).LCP;

  const email = buildUrgentWebVitalAlertEmail({
    payload,
    threshold,
    tenant: {
      brandId: 'brand-1',
      brandName: 'Le Blond',
      includeLocal: false,
      localId: 'local-1',
      localName: 'Centro',
    },
    runtimeEnvironment: 'prod',
    timestamp: payload.timestamp,
    userAgent: 'Browser test',
    cooldownMinutes: 360,
  });

  assert.match(email.subject, /\[Web Vitals\]\[Le Blond\]/);
  assert.doesNotMatch(email.subject, /Centro/);
  assert.equal(email.lines.some((line) => line.startsWith('Local:')), false);
  assert.equal(email.lines.some((line) => line.startsWith('Local ID:')), false);
});
