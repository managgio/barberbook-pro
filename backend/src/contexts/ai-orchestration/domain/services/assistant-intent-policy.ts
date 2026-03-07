import { AiToolName } from '../types/assistant.types';

export const normalizeAiIntentText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export const detectForcedToolFromAssistantPrompt = (lastAssistantMessage?: string): AiToolName | null => {
  if (!lastAssistantMessage) return null;
  const lastNormalized = normalizeAiIntentText(lastAssistantMessage);
  const askedForInfo = /\b(necesito|indicame|indícame|falta|faltan)\b/.test(lastNormalized);
  if (!askedForInfo) return null;
  if (/\b(alert[a-z]*|avis[a-z]*|anunci[a-z]*|comunic[a-z]*|notificacion)\b/.test(lastNormalized)) {
    return 'create_alert';
  }
  if (/\bcita\b/.test(lastNormalized)) {
    return 'create_appointment';
  }
  if (/\b(festiv[a-z]*|vacaci[a-z]*|cerrad[a-z]*|cerrar|cierre)\b/.test(lastNormalized)) {
    const isShop = /\b(local|salon|barberia|negocio|tienda)\b/.test(lastNormalized);
    return isShop ? 'add_shop_holiday' : 'add_barber_holiday';
  }

  return null;
};

export const isLikelyAiToolActionMessage = (message: string) => {
  const normalized = normalizeAiIntentText(message || '');
  if (!normalized) return false;
  const looksQuestion =
    normalized.endsWith('?')
    || /^(como|que|cual|cuando|donde|por que|porque|puedo|podrias|podrias|explica|ayudame)\b/.test(normalized);
  if (looksQuestion) return false;
  const actionVerb = /\b(crea|crear|creame|reserva|reservar|agenda|agendar|anade|anadir|añade|añadir|pon|poner|programa|programar|activa|activar|marca|marcar)\b/.test(
    normalized,
  );
  if (!actionVerb) return false;
  const domainEntity = /\b(cita|festiv|vacaci|cierre|alerta|aviso|anuncio|comunicado)\b/.test(normalized);
  return domainEntity;
};

export const isSingleHolidayRangeIntent = (message: string) => {
  const normalized = normalizeAiIntentText(message || '');
  if (!normalized) return false;
  if (!/\b(festiv|vacaci|cierre|cerrar)\b/.test(normalized)) return false;
  const hasRangeBounds = /\b(desde|del)\b/.test(normalized) && /\b(hasta|al)\b/.test(normalized);
  if (!hasRangeBounds) return false;
  const rangeStarts = normalized.match(/\b(desde|del)\b/g)?.length ?? 0;
  if (rangeStarts > 1) return false;
  const explicitMultiple = /\b(otro|otra|ademas|además|tambien|también|varios|dos|tres)\b/.test(normalized);
  return !explicitMultiple;
};
