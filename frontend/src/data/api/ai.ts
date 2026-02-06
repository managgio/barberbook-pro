import { AiChatResponse, AiChatSessionResponse } from '@/data/types';
import { buildAuthHeaders } from '@/lib/authToken';
import { ApiRequestError } from '@/lib/networkErrors';
import { getStoredLocalId, getTenantSubdomainOverride } from '@/lib/tenant';

import {
  API_BASE,
  AUTH_SESSION_ERROR_EVENT,
  DEFAULT_API_TIMEOUT_MS,
  apiRequest,
  buildApiUrl,
} from './request';

export const postAiAssistantChat = async (payload: {
  message: string;
  sessionId?: string | null;
}): Promise<AiChatResponse> =>
  apiRequest('/admin/ai-assistant/chat', {
    method: 'POST',
    body: { message: payload.message, sessionId: payload.sessionId || undefined },
  });

export const getAiAssistantSession = async (payload: {
  sessionId: string;
}): Promise<AiChatSessionResponse> =>
  apiRequest(`/admin/ai-assistant/session/${payload.sessionId}`);

export const postAiAssistantTranscribe = async (payload: {
  file: File;
}): Promise<{ text: string }> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  const url = buildApiUrl(`${API_BASE}/admin/ai-assistant/transcribe`);
  const authHeaders = await buildAuthHeaders();
  const controller = new AbortController();
  let timeoutTriggered = false;
  const timeoutId = window.setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, DEFAULT_API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...(getStoredLocalId() ? { 'x-local-id': getStoredLocalId() as string } : {}),
        ...(getTenantSubdomainOverride() ? { 'x-tenant-subdomain': getTenantSubdomainOverride() as string } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (timeoutTriggered) {
      throw new ApiRequestError(
        'La transcripción tardó demasiado. Intenta con un audio más corto.',
        408,
        'TIMEOUT',
      );
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError('La transcripción fue cancelada.', 499, 'ABORTED');
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiRequestError('Sin conexión a internet. Verifica tu red e intenta de nuevo.', 0, 'OFFLINE');
    }
    throw new ApiRequestError(
      'No se pudo enviar el audio para transcripción. Intenta nuevamente.',
      0,
      'NETWORK',
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_ERROR_EVENT, { detail: { status: response.status } }));
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

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<{ text: string }>;
  }

  return { text: '' };
};
