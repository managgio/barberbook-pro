export type PlatformMessagingHealthStatus = 'ok' | 'warning' | 'error' | 'disabled';

export type PlatformMessagingHealth = {
  key: 'messaging';
  status: PlatformMessagingHealthStatus;
  summary: string;
  details: string[];
};

export const resolvePlatformMessagingHealth = (input: {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  smsRoutineAllowed: boolean;
  smsGatewayReady: boolean;
  whatsappGatewayReady: boolean;
  smsSenderId: string;
}): PlatformMessagingHealth => {
  if (!input.smsEnabled && !input.whatsappEnabled) {
    return {
      key: 'messaging',
      status: 'disabled',
      summary: 'SMS y WhatsApp desactivados',
      details: [],
    };
  }

  const details: string[] = [];
  let hasError = false;
  let hasWarning = false;

  if (input.smsEnabled) {
    if (!input.smsGatewayReady) {
      hasError = true;
      details.push('El gateway global de SMS no está listo');
    } else if (!input.smsRoutineAllowed) {
      hasWarning = true;
      details.push('El SMS rutinario está bloqueado en este entorno');
    } else {
      details.push(`Gateway SMS listo; remitente esperado ${input.smsSenderId} pendiente de smoke test`);
    }
  }

  if (input.whatsappEnabled) {
    if (!input.whatsappGatewayReady) {
      hasError = true;
      details.push('El gateway global de WhatsApp no está listo');
    } else {
      details.push('WhatsApp global disponible');
    }
  }

  return {
    key: 'messaging',
    status: hasError ? 'error' : hasWarning ? 'warning' : 'ok',
    summary: hasError
      ? 'Mensajería incompleta'
      : hasWarning
        ? 'Mensajería limitada por entorno'
        : 'Mensajería configurada',
    details,
  };
};
