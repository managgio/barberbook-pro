import { apiRequest } from '@/data/api/request';
import type { CriticalTraceLevel, CriticalTraceOutcome } from '@/data/types';

export type CriticalTraceContext = {
  traceId: string;
  path: string;
  serviceId?: string;
  barberId?: string;
  selectedDateTime?: string;
};

type CriticalTracePayload = CriticalTraceContext & {
  category?: string;
  stage: string;
  level: CriticalTraceLevel;
  outcome: CriticalTraceOutcome;
  appointmentId?: string;
  message?: string;
  errorName?: string;
  errorCode?: string;
  errorStack?: string;
  metadata?: Record<string, string | number | boolean | null>;
  occurredAt?: number;
};

type CriticalTraceBreadcrumb = {
  stage: string;
  outcome: CriticalTraceOutcome;
  occurredAt: number;
  elapsedMs: number;
  serviceId?: string;
  barberId?: string;
  selectedDateTime?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type CriticalTraceBuffer = {
  startedAt: number;
  lastTouchedAt: number;
  breadcrumbs: CriticalTraceBreadcrumb[];
};

const MAX_BUFFERED_TRACES = 20;
const MAX_BREADCRUMBS = 24;
const TRACE_BUFFER_TTL_MS = 30 * 60_000;
const TERMINAL_SUCCESS_STAGES = new Set(['appointment_submit', 'appointment_checkout']);

let activeContext: (CriticalTraceContext & { activatedAt: number }) | null = null;
const traceBuffers = new Map<string, CriticalTraceBuffer>();

const pruneTraceBuffers = (now: number) => {
  traceBuffers.forEach((buffer, traceId) => {
    if (now - buffer.lastTouchedAt > TRACE_BUFFER_TTL_MS) traceBuffers.delete(traceId);
  });
  while (traceBuffers.size >= MAX_BUFFERED_TRACES) {
    const oldestTraceId = traceBuffers.keys().next().value as string | undefined;
    if (!oldestTraceId) break;
    traceBuffers.delete(oldestTraceId);
  }
};

const getTraceBuffer = (traceId: string, occurredAt: number) => {
  const existing = traceBuffers.get(traceId);
  if (existing) {
    existing.lastTouchedAt = occurredAt;
    return existing;
  }
  pruneTraceBuffers(occurredAt);
  const created: CriticalTraceBuffer = { startedAt: occurredAt, lastTouchedAt: occurredAt, breadcrumbs: [] };
  traceBuffers.set(traceId, created);
  return created;
};

export const createCriticalTraceId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `booking-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const setActiveCriticalTrace = (context: CriticalTraceContext | null) => {
  activeContext = context ? { ...context, activatedAt: Date.now() } : null;
};

export const updateActiveCriticalTrace = (context: Partial<CriticalTraceContext>) => {
  if (!activeContext) return;
  activeContext = { ...activeContext, ...context };
};

export const reportCriticalTrace = async (payload: CriticalTracePayload) => {
  const occurredAt = payload.occurredAt ?? Date.now();
  const isFailure = payload.outcome === 'failed' || payload.level === 'error';
  const buffer = getTraceBuffer(payload.traceId, occurredAt);

  if (!isFailure) {
    buffer.breadcrumbs.push({
      stage: payload.stage,
      outcome: payload.outcome,
      occurredAt,
      elapsedMs: Math.max(0, occurredAt - buffer.startedAt),
      serviceId: payload.serviceId,
      barberId: payload.barberId,
      selectedDateTime: payload.selectedDateTime,
      metadata: payload.metadata,
    });
    if (buffer.breadcrumbs.length > MAX_BREADCRUMBS) buffer.breadcrumbs.shift();
    if (payload.outcome === 'succeeded' && TERMINAL_SUCCESS_STAGES.has(payload.stage)) {
      traceBuffers.delete(payload.traceId);
      if (activeContext?.traceId === payload.traceId) activeContext = null;
    }
    return;
  }

  const breadcrumbs = JSON.stringify(buffer.breadcrumbs).slice(0, 6000);
  traceBuffers.delete(payload.traceId);
  try {
    await apiRequest('/observability/critical-traces', {
      method: 'POST',
      body: {
        ...payload,
        category: payload.category ?? 'booking',
        occurredAt,
        metadata: {
          ...payload.metadata,
          breadcrumbCount: buffer.breadcrumbs.length,
          breadcrumbs,
          traceStartedAt: buffer.startedAt,
        },
      },
      timeoutMs: 5_000,
    });
  } catch {
    // La telemetría nunca debe bloquear ni romper el flujo principal de reserva.
  }
};

export const reportActiveCriticalBookingRenderError = (error: Error, componentStack?: string | null) => {
  if (!activeContext) return;
  if (Date.now() - activeContext.activatedAt > 30 * 60_000) return;
  if (typeof window !== 'undefined' && window.location.pathname !== activeContext.path) return;
  const { activatedAt: _activatedAt, ...traceContext } = activeContext;
  const documentElement = document.documentElement;
  const browserTranslationDetected =
    documentElement.classList.contains('translated-ltr') ||
    documentElement.classList.contains('translated-rtl') ||
    Boolean(document.querySelector('.goog-te-banner-frame, iframe.goog-te-banner-frame, [class*="goog-te-"]'));
  void reportCriticalTrace({
    ...traceContext,
    stage: 'frontend_render',
    level: 'error',
    outcome: 'failed',
    message: error.message || 'Error no controlado al renderizar el flujo de reserva',
    errorName: error.name,
    errorStack: error.stack?.slice(0, 8000),
    metadata: {
      componentStack: componentStack?.slice(0, 3000) ?? null,
      browserTranslationDetected,
      documentLanguage: documentElement.lang || null,
      documentTranslate: documentElement.getAttribute('translate'),
      documentClass: documentElement.className.slice(0, 500) || null,
      browserLanguages: navigator.languages?.join(',').slice(0, 500) || navigator.language || null,
    },
  });
};
