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

let activeContext: (CriticalTraceContext & { activatedAt: number }) | null = null;

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
  try {
    await apiRequest('/observability/critical-traces', {
      method: 'POST',
      body: { ...payload, category: payload.category ?? 'booking', occurredAt: payload.occurredAt ?? Date.now() },
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
