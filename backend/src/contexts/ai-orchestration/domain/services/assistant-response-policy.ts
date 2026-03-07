import { AiCreateAlertResult, AiCreateAppointmentResult, AiHolidayActionResult } from '../types/assistant.types';

const formatTimeInTimeZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

const formatDateInTimeZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

export const buildCreateAppointmentFallbackMessage = (
  result: AiCreateAppointmentResult,
  timeZone: string,
): string | null => {
  if (result.status === 'created') {
    const startDateTime = result.startDateTime ? new Date(result.startDateTime) : null;
    const dateLabel = startDateTime ? formatDateInTimeZone(startDateTime, timeZone) : '';
    const timeLabel = startDateTime ? formatTimeInTimeZone(startDateTime, timeZone) : '';
    const parts = ['Cita creada.'];
    if (result.userType === 'guest') {
      const guestLabel = result.guestName || result.clientName || 'Invitado';
      parts.push(`Cliente invitado: ${guestLabel}.`);
    } else if (result.clientName) {
      parts.push(`Cliente registrado: ${result.clientName}.`);
    }
    if (dateLabel) {
      parts.push(`Fecha: ${dateLabel}.`);
    }
    if (timeLabel) {
      parts.push(`Hora: ${timeLabel}.`);
    }
    if (result.serviceName) {
      parts.push(`Servicio: ${result.serviceName}.`);
    }
    if (result.barberName) {
      parts.push(`Barbero: ${result.barberName}.`);
    }
    return parts.join(' ');
  }
  if (result.status === 'unavailable') {
    if (result.reason === 'no_active_barbers') {
      return 'No hay barberos activos disponibles en este momento.';
    }
    if (result.reason === 'shop_holiday') {
      return 'Ese día el local está cerrado por festivo.';
    }
    if (result.reason === 'slot_window_unavailable') {
      return 'No hay disponibilidad en el rango solicitado.';
    }
    return 'No hay disponibilidad para ese horario con el servicio indicado.';
  }
  if (result.status === 'error') {
    return 'No pude crear la cita ahora mismo.';
  }
  if (result.status === 'needs_info') {
    if (result.reason === 'barber_inactive') {
      return 'Ese barbero no está activo. Indícame otro barbero disponible.';
    }
    if ((result.missing ?? []).includes('serviceId') && result.options?.services?.length) {
      const options = result.options.services
        .slice(0, 5)
        .map((service) => service.name);
      return `Hay varios servicios posibles. Indícame uno: ${options.join(', ')}.`;
    }
    if ((result.missing ?? []).includes('barberId') && result.options?.barbers?.length) {
      const options = result.options.barbers
        .slice(0, 5)
        .map((barber) => barber.name);
      return `Hay varios barberos posibles. Indícame uno: ${options.join(', ')}.`;
    }
    if (result.reason === 'user_ambiguous' && result.options?.users?.length) {
      const options = result.options.users
        .slice(0, 3)
        .map((user) => `${user.name} (${user.email})`);
      return `Hay varios clientes con ese nombre. Indica el cliente por nombre completo o email. Opciones: ${options.join(', ')}.`;
    }
    const missingLabels = new Set<string>();
    (result.missing ?? []).forEach((missing) => {
      if (missing === 'date') missingLabels.add('fecha');
      if (missing === 'time') missingLabels.add('hora');
      if (missing === 'barberId' || missing === 'barberName') missingLabels.add('barbero');
      if (missing === 'serviceId' || missing === 'serviceName') missingLabels.add('servicio');
      if (missing === 'userName') missingLabels.add('nombre del cliente');
      if (missing === 'userEmail') missingLabels.add('email del cliente');
      if (missing === 'userPhone') missingLabels.add('teléfono del cliente');
    });
    if (missingLabels.size === 0) {
      return 'Necesito un poco más de información para crear la cita.';
    }
    let response = `Para crear la cita necesito: ${Array.from(missingLabels).join(', ')}.`;
    if (result.options?.barbers?.length) {
      const options = result.options.barbers.slice(0, 3).map((barber) => barber.name);
      response += ` Barberos posibles: ${options.join(', ')}.`;
    }
    if (result.options?.services?.length) {
      const options = result.options.services.slice(0, 3).map((service) => service.name);
      response += ` Servicios posibles: ${options.join(', ')}.`;
    }
    return response;
  }
  return null;
};

export const buildHolidayResponseMessage = (result: AiHolidayActionResult): string | null => {
  if (result.status === 'error') {
    return 'No pude crear el festivo ahora mismo.';
  }
  if (result.status === 'needs_info') {
    const missing = new Set(result.missing ?? []);
    if (missing.has('startDate') && result.scope === 'shop') {
      return 'Indícame la fecha o rango para el festivo del local.';
    }
    if (missing.has('startDate') && result.scope === 'barber') {
      return 'Indícame la fecha o rango para el festivo del barbero.';
    }
    if (missing.has('barberIds')) {
      return 'Indícame el barbero o confirma si el festivo es para el local.';
    }
    return 'Necesito más información para crear el festivo.';
  }
  if (result.status === 'added') {
    const start = result.range?.start;
    const end = result.range?.end;
    const rangeLabel = start && end && start !== end ? `${start} al ${end}` : start;
    if (result.scope === 'shop') {
      return rangeLabel
        ? `Festivo creado para el local del ${rangeLabel}.`
        : 'Festivo creado para el local.';
    }
    if (result.barberNames?.length) {
      const names = result.barberNames.join(', ');
      return rangeLabel
        ? `Festivo creado para ${names} del ${rangeLabel}.`
        : `Festivo creado para ${names}.`;
    }
    return rangeLabel
      ? `Festivo creado para el barbero del ${rangeLabel}.`
      : 'Festivo creado para el barbero.';
  }
  return null;
};

export const buildAlertResponseMessage = (result: AiCreateAlertResult): string | null => {
  if (result.status === 'error') {
    return 'No pude crear la alerta ahora mismo.';
  }
  if (result.status === 'needs_info') {
    return 'Necesito un poco mas de detalle sobre la alerta para poder crearla.';
  }
  if (result.status === 'created') {
    const title = result.title ? ` ${result.title}` : '';
    return `Alerta creada.${title}`;
  }
  return null;
};

export const stripAssistantFormatting = (text: string) => text.replace(/[*_`]/g, '');

export const stripUnsupportedAssistantSections = (text: string) => {
  const lines = text.split('\n');
  const cleaned: string[] = [];
  let skipBlock = false;

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!trimmed) {
      if (!skipBlock) {
        cleaned.push(line);
      }
      continue;
    }
    if (trimmed.startsWith('recomendacion:') || trimmed.startsWith('acciones sugeridas:')) {
      skipBlock = true;
      continue;
    }
    if (skipBlock) {
      const isBullet = /^\s*[-•]/.test(line);
      if (isBullet) {
        continue;
      }
      skipBlock = false;
    }
    cleaned.push(line);
  }

  return cleaned.join('\n').trim();
};

export const sanitizeAssistantMessage = (text: string) =>
  stripUnsupportedAssistantSections(stripAssistantFormatting(text));
