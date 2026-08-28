import { PlatformWebVitalReport } from '../../contexts/platform/domain/entities/platform-observability.entity';
import { WebVitalAlertThreshold } from './web-vital-alert-policy';

type WebVitalAlertTenant = {
  brandId: string;
  brandName: string | null;
  includeLocal: boolean;
  localId: string;
  localName: string | null;
};

const normalizeEmailLabel = (value: string) => value
  .replace(/[\r\n]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120);

export const buildUrgentWebVitalAlertEmail = (params: {
  payload: PlatformWebVitalReport;
  threshold: WebVitalAlertThreshold;
  tenant: WebVitalAlertTenant;
  runtimeEnvironment: string;
  timestamp: number;
  userAgent?: string;
  cooldownMinutes: number;
}) => {
  const brandName = normalizeEmailLabel(params.tenant.brandName || `Brand ${params.tenant.brandId}`);
  const localName = normalizeEmailLabel(params.tenant.localName || `Local ${params.tenant.localId}`);
  const businessLabel = normalizeEmailLabel(
    params.tenant.includeLocal && brandName !== localName
      ? `${brandName} · ${localName}`
      : brandName,
  );
  const value = Number(params.payload.value).toFixed(2);
  const localLines = params.tenant.includeLocal
    ? [`Local: ${localName}`]
    : [];
  const localIdLines = params.tenant.includeLocal
    ? [`Local ID: ${params.tenant.localId}`]
    : [];

  return {
    subject: `[CRITICAL][${params.runtimeEnvironment.toUpperCase()}][Web Vitals][${businessLabel}] ${params.payload.name} ${value}${params.threshold.unit}`,
    lines: [
      'WEB VITAL CRITICO: requiere revision urgente.',
      '',
      `Negocio / tenant: ${brandName}`,
      ...localLines,
      `Environment: ${params.runtimeEnvironment}`,
      `Metric: ${params.payload.name}`,
      `Value: ${value} ${params.threshold.unit}`,
      `Critical threshold: >= ${params.threshold.critical} ${params.threshold.unit}`,
      `Poor threshold: > ${params.threshold.poor} ${params.threshold.unit}`,
      `Path: ${params.payload.path}`,
      `Brand ID: ${params.tenant.brandId}`,
      ...localIdLines,
      `Timestamp: ${new Date(params.timestamp).toISOString()}`,
      `User-Agent: ${(params.userAgent || 'unknown').slice(0, 200)}`,
      '',
      `Alert policy: critical events only; cooldown ${params.cooldownMinutes} minutes per metric/tenant`,
    ],
  };
};
