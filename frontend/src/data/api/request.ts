import { buildAuthHeaders } from '@/lib/authToken';
import { ApiRequestError } from '@/lib/networkErrors';
import { getStoredLocalId, getTenantSubdomainOverride } from '@/lib/tenant';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export const DEFAULT_API_TIMEOUT_MS = 15_000;
export const AUTH_SESSION_ERROR_EVENT = 'app:auth-session-error';

const IDEMPOTENT_RETRY_DELAYS_MS = [300, 900];
const RETRIABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
let lastAuthSessionEventAt = 0;

export type QueryParams = Record<string, string | number | undefined | null>;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  skip404?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export const buildApiUrl = (path: string, query?: QueryParams) => {
  const url = new URL(path, API_BASE.startsWith('http') ? API_BASE : window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const waitWithAbort = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new ApiRequestError('La solicitud fue cancelada.', 499, 'ABORTED'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });

const emitAuthSessionError = (status: number) => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastAuthSessionEventAt < 2_000) return;
  lastAuthSessionEventAt = now;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_ERROR_EVENT, { detail: { status } }));
};

const shouldRetryHttpStatus = (status: number) => RETRIABLE_HTTP_STATUSES.has(status);
const shouldRetryNetworkError = (kind: ApiRequestError['kind']) => kind === 'TIMEOUT' || kind === 'NETWORK';

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, query, skip404, headers, timeoutMs = DEFAULT_API_TIMEOUT_MS, signal } = options;
  const url = buildApiUrl(path.startsWith('http') ? path : `${API_BASE}${path}`, query);
  const localId = getStoredLocalId();
  const tenantOverride = getTenantSubdomainOverride();
  const authHeaders = await buildAuthHeaders();
  const isIdempotentGet = method === 'GET' && body === undefined;
  const maxAttempts = isIdempotentGet ? IDEMPOTENT_RETRY_DELAYS_MS.length + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timeoutTriggered = false;
    const timeoutId = window.setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, timeoutMs);
    const abortHandler = () => controller.abort();

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new ApiRequestError('La solicitud fue cancelada.', 499, 'ABORTED');
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...(localId ? { 'x-local-id': localId } : {}),
          ...(tenantOverride ? { 'x-tenant-subdomain': tenantOverride } : {}),
          ...(headers || {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (skip404 && response.status === 404) {
          return undefined as T;
        }

        if ([401, 403].includes(response.status)) {
          emitAuthSessionError(response.status);
        }

        if (attempt < maxAttempts - 1 && shouldRetryHttpStatus(response.status)) {
          await waitWithAbort(IDEMPOTENT_RETRY_DELAYS_MS[attempt] ?? 1_500, signal);
          continue;
        }

        let message = await response.text();
        try {
          const parsed = JSON.parse(message) as { message?: string; error?: string };
          message = parsed.message || parsed.error || message;
        } catch {
          // Keep raw message when it's not JSON.
        }

        throw new ApiRequestError(
          message || `API request failed (${response.status})`,
          response.status,
          'HTTP',
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json() as Promise<T>;
      }

      return undefined as T;
    } catch (error) {
      const apiError =
        error instanceof ApiRequestError
          ? error
          : timeoutTriggered
            ? new ApiRequestError(
              'La solicitud tardó demasiado. Revisa tu conexión e intenta nuevamente.',
              408,
              'TIMEOUT',
            )
            : error instanceof DOMException && error.name === 'AbortError'
              ? new ApiRequestError('La solicitud fue cancelada.', 499, 'ABORTED')
              : typeof navigator !== 'undefined' && navigator.onLine === false
                ? new ApiRequestError('Sin conexión a internet. Verifica tu red e intenta de nuevo.', 0, 'OFFLINE')
                : new ApiRequestError(
                  'No se pudo conectar con el servidor. Intenta nuevamente en unos segundos.',
                  0,
                  'NETWORK',
                );

      if (attempt < maxAttempts - 1 && shouldRetryNetworkError(apiError.kind)) {
        await waitWithAbort(IDEMPOTENT_RETRY_DELAYS_MS[attempt] ?? 1_500, signal);
        continue;
      }

      throw apiError;
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  throw new ApiRequestError('No se pudo completar la solicitud.', 0, 'NETWORK');
};
