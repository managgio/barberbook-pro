import { Inject, Injectable, Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import {
  AI_ALERT_TOOL_PORT,
  AiAlertToolPort,
} from '../../contexts/ai-orchestration/ports/outbound/ai-alert-tool.port';
import {
  AI_BOOKING_TOOL_PORT,
  AiBookingToolPort,
} from '../../contexts/ai-orchestration/ports/outbound/ai-booking-tool.port';
import {
  AI_HOLIDAY_TOOL_PORT,
  AiHolidayToolPort,
} from '../../contexts/ai-orchestration/ports/outbound/ai-holiday-tool.port';
import {
  AI_TOOLS_READ_PORT,
  AiToolsReadPort,
} from '../../contexts/ai-orchestration/ports/outbound/ai-tools-read.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import {
  formatTimeInTimeZone,
  addDays,
  getDateStringInTimeZone,
  isValidDateString,
  parseDateString,
  parseDateFromText,
  parseDateRangeFromText,
  parseTimeFromText,
  toDateInTimeZone,
} from './ai-assistant.utils';
import { AlertType } from '@prisma/client';
import {
  AiCreateAlertResult,
  AiCreateAppointmentResult,
  AiHolidayActionResult,
  AiToolContext,
  AiToolName,
} from './ai-assistant.types';

const AUTO_SLOT_SEARCH_DAYS = 14;

type DayPeriod = 'morning' | 'afternoon' | 'night';

const TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: 'Crea una cita nueva tras validar disponibilidad y horario. Si no hay hora exacta, backend puede elegir el primer hueco disponible.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
          time: { type: 'string', description: 'Hora HH:mm.' },
          dateText: { type: 'string', description: 'Fecha en lenguaje natural (ej: 12 de enero).' },
          timeText: { type: 'string', description: 'Hora en lenguaje natural (ej: 18:00).' },
          rawText: { type: 'string', description: 'Texto original del usuario para interpretar fecha/hora/preferencias como "lo antes posible" o "por la tarde".' },
          startDateTime: { type: 'string', description: 'Fecha/hora ISO opcional.' },
          barberId: { type: 'string', description: 'ID del barbero.' },
          barberName: { type: 'string', description: 'Nombre del barbero.' },
          serviceId: { type: 'string', description: 'ID del servicio.' },
          serviceName: { type: 'string', description: 'Nombre del servicio.' },
          userName: { type: 'string', description: 'Nombre del cliente.' },
          userEmail: { type: 'string', description: 'Email del cliente (opcional).' },
          userPhone: { type: 'string', description: 'Teléfono del cliente (opcional).' },
          notes: { type: 'string', description: 'Comentario del cliente.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_shop_holiday',
      description: 'Añade un festivo general del negocio (local/salón).',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Fecha inicio YYYY-MM-DD.' },
          endDate: { type: 'string', description: 'Fecha fin YYYY-MM-DD.' },
          dateText: { type: 'string', description: 'Rango en lenguaje natural (ej: 15 y 16 de enero).' },
          rawText: { type: 'string', description: 'Texto original del usuario.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_barber_holiday',
      description: 'Añade vacaciones para uno o varios barberos.',
      parameters: {
        type: 'object',
        properties: {
          barberIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs internos de barberos.',
          },
          barberNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Nombres de barberos.',
          },
          barberName: { type: 'string', description: 'Nombre del barbero.' },
          allBarbers: { type: 'boolean', description: 'Aplicar a todos los barberos activos.' },
          startDate: { type: 'string', description: 'Fecha inicio YYYY-MM-DD.' },
          endDate: { type: 'string', description: 'Fecha fin YYYY-MM-DD.' },
          dateText: { type: 'string', description: 'Rango en lenguaje natural (ej: 15 y 16 de enero).' },
          rawText: { type: 'string', description: 'Texto original del usuario.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_alert',
      description: 'Crea una alerta para clientes con titulo, mensaje y tipo. Puede programar fechas en lenguaje natural (ej: "una semana a partir de mañana").',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Titulo conciso y claro.' },
          message: { type: 'string', description: 'Mensaje algo mas descriptivo y cercano.' },
          type: {
            type: 'string',
            enum: ['info', 'warning', 'success'],
            description: 'Tipo de alerta (info, warning o success).',
          },
          active: { type: 'boolean', description: 'Si la alerta debe quedar activa.' },
          startDate: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (opcional).' },
          endDate: { type: 'string', description: 'Fecha fin YYYY-MM-DD (opcional).' },
          rawText: { type: 'string', description: 'Texto original del usuario.' },
        },
        required: ['title', 'message', 'type'],
        additionalProperties: false,
      },
    },
  },
];

@Injectable()
export class AiToolsRegistry {
  private readonly logger = new Logger(AiToolsRegistry.name);

  constructor(
    @Inject(AI_TOOLS_READ_PORT)
    private readonly aiToolsReadPort: AiToolsReadPort,
    @Inject(AI_BOOKING_TOOL_PORT)
    private readonly bookingToolPort: AiBookingToolPort,
    @Inject(AI_HOLIDAY_TOOL_PORT)
    private readonly holidayToolPort: AiHolidayToolPort,
    @Inject(AI_ALERT_TOOL_PORT)
    private readonly alertToolPort: AiAlertToolPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private getBrandId() {
    return this.tenantContextPort.getRequestContext().brandId;
  }

  getTools() {
    return TOOL_DEFINITIONS;
  }

  private normalizeText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private shouldPreferParsedRange(text: string) {
    if (!text) return false;
    const normalized = this.normalizeText(text);
    const hasExplicitBounds = /\b(desde|hasta|del?|al|entre|a partir de)\b/.test(normalized);
    const hasExplicitWeekday = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(normalized);
    if (hasExplicitBounds || hasExplicitWeekday) return false;
    return /\b(toda?\s+la\s+semana|semana\s+que\s+viene|proxima\s+semana|siguiente\s+semana|esta\s+semana)\b/.test(
      normalized,
    );
  }

  async execute(toolName: AiToolName, args: Record<string, unknown>, context: AiToolContext) {
    switch (toolName) {
      case 'create_appointment':
        return this.createAppointment(args, context);
      case 'add_shop_holiday':
        return this.addShopHoliday(args, context);
      case 'add_barber_holiday':
        return this.addBarberHoliday(args, context);
      case 'create_alert':
        return this.createAlert(args, context);
      default:
        throw new Error(`Tool no soportada: ${toolName}`);
    }
  }

  private async addShopHoliday(args: Record<string, unknown>, context: AiToolContext): Promise<AiHolidayActionResult> {
    const startDateInput = typeof args.startDate === 'string' ? args.startDate.trim() : '';
    const endDateInput = typeof args.endDate === 'string' ? args.endDate.trim() : '';
    const dateText = typeof args.dateText === 'string' ? args.dateText.trim() : '';
    const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';
    const rangeText = [dateText, rawText].filter(Boolean).join(' ');

    let startDate = isValidDateString(startDateInput) ? startDateInput : '';
    let endDate = isValidDateString(endDateInput) ? endDateInput : '';
    const parsedRange = parseDateRangeFromText(rangeText, context.now, context.timeZone);
    const preferParsedRange = this.shouldPreferParsedRange(rangeText);

    if (parsedRange && (preferParsedRange || !startDate || !endDate)) {
      startDate = parsedRange.start;
      endDate = parsedRange.end;
    }

    if (!startDate) {
      return { status: 'needs_info', scope: 'shop', missing: ['startDate'] };
    }

    if (!endDate) {
      endDate = startDate;
    }

    await this.holidayToolPort.addGeneralHoliday({ start: startDate, end: endDate });
    return {
      status: 'added',
      scope: 'shop',
      range: { start: startDate, end: endDate },
      added: 1,
    };
  }

  private async addBarberHoliday(args: Record<string, unknown>, context: AiToolContext): Promise<AiHolidayActionResult> {
    const startDateInput = typeof args.startDate === 'string' ? args.startDate.trim() : '';
    const endDateInput = typeof args.endDate === 'string' ? args.endDate.trim() : '';
    const dateText = typeof args.dateText === 'string' ? args.dateText.trim() : '';
    const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';
    const rangeText = [dateText, rawText].filter(Boolean).join(' ');
    const barberNameInput = typeof args.barberName === 'string' ? args.barberName.trim() : '';
    const barberNamesInput = Array.isArray(args.barberNames)
      ? (args.barberNames.filter((name) => typeof name === 'string') as string[]).map((name) => name.trim())
      : [];

    const normalizeValue = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const splitNameList = (value: string) =>
      value
        .split(/\s*(?:,|\s+y\s+|\s+e\s+)\s*/i)
        .map((part) => part.trim())
        .filter(Boolean);
    const stripArticles = (value: string) => value.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
    const blockedNames = new Set([
      'local',
      'salon',
      'barberia',
      'negocio',
      'tienda',
      'dia',
      'fecha',
      'rango',
      'semana',
      'mes',
      'manana',
      'festivo',
      'vacaciones',
      'cierre',
    ]);
    const isValidNameCandidate = (value: string) => {
      const cleaned = stripArticles(value);
      if (!cleaned) return false;
      const normalized = normalizeValue(cleaned);
      if (!/[a-z]/.test(normalized)) return false;
      if (blockedNames.has(normalized)) return false;
      return true;
    };
    const extractNamesFromText = (text: string) => {
      if (!text) return [];
      const namePattern = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+";
      const multiNamePattern = `${namePattern}(?:\\s+${namePattern}){0,3}`;
      const listPattern = `${multiNamePattern}(?:\\s*(?:,|y|e)\\s*${multiNamePattern})*`;
      const matches: string[] = [];
      const barberMatch = text.match(
        new RegExp(`\\b(?:barber[oa]|barbero|barbera|peluquer[oa]|trabajador(?:a)?|emplead(?:o|a)?)\\s+(${listPattern})`, 'i'),
      );
      const paraMatch = text.match(
        new RegExp(
          `\\bpara\\s+(${listPattern})(?=\\s+para\\b|\\s+el\\b|\\s+del\\b|\\s+desde\\b|\\s+hasta\\b|\\s+al\\b|\\s+a\\s+las\\b|\\s+en\\b|\\s*$)`,
          'i',
        ),
      );
      if (barberMatch?.[1]) matches.push(barberMatch[1]);
      if (paraMatch?.[1]) matches.push(paraMatch[1]);
      return matches.flatMap(splitNameList).map(stripArticles).filter(isValidNameCandidate);
    };

    let startDate = isValidDateString(startDateInput) ? startDateInput : '';
    let endDate = isValidDateString(endDateInput) ? endDateInput : '';
    const parsedRange = parseDateRangeFromText(rangeText, context.now, context.timeZone);
    const preferParsedRange = this.shouldPreferParsedRange(rangeText);

    if (parsedRange && (preferParsedRange || !startDate || !endDate)) {
      startDate = parsedRange.start;
      endDate = parsedRange.end;
    }

    if (!startDate) {
      return { status: 'needs_info', scope: 'barber', missing: ['startDate'] };
    }

    if (!endDate) {
      endDate = startDate;
    }

    let barberIds = Array.isArray(args.barberIds)
      ? (args.barberIds.filter((id) => typeof id === 'string') as string[])
      : [];
    const barberIdsInput = [...barberIds];
    let allBarbers = args.allBarbers === true;
    if (!allBarbers && rawText) {
      const normalizedRaw = normalizeValue(rawText);
      if (/\b(todos|todas)\s+los\s+barber(os|as)\b/.test(normalizedRaw) || /\btodo\s+el\s+equipo\b/.test(normalizedRaw)) {
        allBarbers = true;
      }
    }

    if (allBarbers) {
      const barbers = await this.aiToolsReadPort.findActiveBarbers({
        localId: this.getLocalId(),
      });
      barberIds = barbers.map((barber) => barber.id);
    }

    if (barberIds.length > 0) {
      const existing = await this.aiToolsReadPort.findBarbersByIds({
        localId: this.getLocalId(),
        barberIds,
      });
      barberIds = existing.map((barber) => barber.id);
    }

    if (barberIds.length === 0) {
      const nameCandidates = new Set<string>();
      if (barberIdsInput.length > 0) {
        barberIdsInput.map((value) => value.trim()).filter(Boolean).forEach((value) => nameCandidates.add(value));
      }
      if (barberNameInput) {
        splitNameList(barberNameInput).forEach((name) => nameCandidates.add(name));
      }
      barberNamesInput.filter(Boolean).forEach((name) => {
        splitNameList(name).forEach((part) => nameCandidates.add(part));
      });
      extractNamesFromText(rawText).forEach((name) => nameCandidates.add(name));

      const filteredCandidates = Array.from(nameCandidates)
        .map(stripArticles)
        .filter(isValidNameCandidate);

      if (filteredCandidates.length > 0) {
        const resolvedIds = new Set<string>();
        const ambiguousMatches: { id: string; name: string; isActive: boolean }[] = [];
        for (const candidate of filteredCandidates) {
          const matches = await this.aiToolsReadPort.findBarbersByName({
            localId: this.getLocalId(),
            name: candidate,
            take: 5,
          });
          if (matches.length === 1) {
            resolvedIds.add(matches[0].id);
          } else if (matches.length > 1) {
            matches.forEach((match) => ambiguousMatches.push(match));
          }
        }

        if (ambiguousMatches.length > 0) {
          const uniqueMatches = new Map<string, { id: string; name: string; isActive: boolean }>();
          ambiguousMatches.forEach((match) => uniqueMatches.set(match.id, match));
          return {
            status: 'needs_info',
            scope: 'barber',
            missing: ['barberIds'],
            options: { barbers: Array.from(uniqueMatches.values()).sort((a, b) => a.name.localeCompare(b.name)) },
          };
        }

        barberIds = Array.from(resolvedIds);
      }
    }

    if (barberIds.length === 0) {
      return { status: 'needs_info', scope: 'barber', missing: ['barberIds'] };
    }

    for (const barberId of barberIds) {
      await this.holidayToolPort.addBarberHoliday(barberId, { start: startDate, end: endDate });
    }

    const barberNames = await this.aiToolsReadPort.findBarbersByIds({
      localId: this.getLocalId(),
      barberIds,
    });

    return {
      status: 'added',
      scope: 'barber',
      range: { start: startDate, end: endDate },
      barberIds,
      barberNames: barberNames.map((barber) => barber.name).sort((a, b) => a.localeCompare(b, 'es')),
      added: barberIds.length,
    };
  }

  private async createAppointment(
    args: Record<string, unknown>,
    context: AiToolContext,
  ): Promise<AiCreateAppointmentResult> {
    try {
      const dateInput = typeof args.date === 'string' ? args.date.trim() : '';
      const timeInput = typeof args.time === 'string' ? args.time.trim() : '';
      const startDateTimeInput = typeof args.startDateTime === 'string' ? args.startDateTime.trim() : '';
      const dateText = typeof args.dateText === 'string' ? args.dateText.trim() : '';
      const timeText = typeof args.timeText === 'string' ? args.timeText.trim() : '';
      const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';

      this.applyEntityInferenceFromRawText(args, rawText);
      await this.sanitizeUntrustedBarberSelection(args, rawText);
      await this.sanitizeUntrustedServiceSelection(args, rawText);

      const serviceResult = await this.resolveService(args);
      if (serviceResult.status !== 'ok') {
        return serviceResult.result;
      }

      const userResult = await this.resolveUser(args);
      if (userResult.status !== 'ok') {
        return userResult.result;
      }

      let date = '';
      let time = '';
      const parsedTimeFromUserText = parseTimeFromText(rawText);
      let hasExplicitTime = Boolean(parsedTimeFromUserText);
      if (startDateTimeInput) {
        const parsed = new Date(startDateTimeInput);
        if (Number.isNaN(parsed.getTime())) {
          return { status: 'needs_info', missing: ['date', 'time'] };
        }
        date = getDateStringInTimeZone(parsed, context.timeZone);
        time = formatTimeInTimeZone(parsed, context.timeZone);
      } else {
        const timeLooksValid = /^\d{2}:\d{2}$/.test(timeInput);
        if (isValidDateString(dateInput)) {
          date = dateInput;
        }
        if (timeLooksValid) {
          time = timeInput;
        }
        const combinedText = [dateText, timeText, rawText].filter(Boolean).join(' ');
        const parsedDate = parseDateFromText(combinedText, context.now, context.timeZone);
        const parsedTime = parseTimeFromText(combinedText);
        const hasExplicitYear = /\b(19|20)\d{2}\b/.test(combinedText);
        if (parsedDate && (!hasExplicitYear || !date)) {
          date = parsedDate;
        }
        if (parsedTime && (!time || !timeLooksValid)) {
          time = parsedTime;
        }
      }
      if (parsedTimeFromUserText) {
        time = parsedTimeFromUserText;
      }
      if (time) {
        time = time.slice(0, 5);
      }
      if (time && !/^\d{2}:\d{2}$/.test(time)) {
        return { status: 'needs_info', missing: ['time'] };
      }

      if (date && (await this.isGeneralHolidayDate(date))) {
        return { status: 'unavailable', reason: 'shop_holiday' };
      }

      const normalizedIntent = this.normalizeIntentText([rawText, dateText, timeText].filter(Boolean).join(' '));
      const dayPeriod = this.extractDayPeriod(normalizedIntent);
      const wantsSoonest = this.isSoonestRequest(normalizedIntent);

      if (!date && hasExplicitTime) {
        return { status: 'needs_info', missing: ['date'] };
      }
      if (!date && !wantsSoonest) {
        return {
          status: 'needs_info',
          missing: hasExplicitTime ? ['date'] : ['date', 'time'],
        };
      }

      let selectedBarbers: Array<{ id: string; name: string }> = [];
      if (this.hasExplicitBarberSelection(args)) {
        const barberResult = await this.resolveBarber(args);
        if (barberResult.status !== 'ok') {
          return barberResult.result;
        }
        selectedBarbers = [barberResult.barber];
      } else {
        selectedBarbers = await this.getActiveBarbers();
      }
      if (selectedBarbers.length === 0) {
        return { status: 'unavailable', reason: 'no_active_barbers' };
      }

      const slotResolution = await this.resolveBarberAndSlot({
        context,
        barbers: selectedBarbers,
        serviceId: serviceResult.service.id,
        date: date || null,
        time: hasExplicitTime ? time : null,
        dayPeriod,
        wantsSoonest,
      });
      if (slotResolution.status !== 'ok') {
        return slotResolution.result;
      }

      const startDateTime = toDateInTimeZone(slotResolution.date, slotResolution.time, context.timeZone);
      const created = await this.bookingToolPort.createAppointment({
        barberId: slotResolution.barber.id,
        serviceId: serviceResult.service.id,
        startDateTime: startDateTime.toISOString(),
        status: 'scheduled',
        userId: userResult.userId ?? undefined,
        guestName: userResult.guestName ?? undefined,
        guestContact: userResult.guestContact ?? undefined,
        notes: typeof args.notes === 'string' ? args.notes : undefined,
      });

      return {
        status: 'created',
        appointmentId: created.id,
        startDateTime: created.startDateTime,
        barberId: slotResolution.barber.id,
        barberName: slotResolution.barber.name,
        serviceId: serviceResult.service.id,
        serviceName: serviceResult.service.name,
        userType: userResult.userId ? 'registered' : 'guest',
        guestName: userResult.userId ? undefined : userResult.guestName,
        clientName: userResult.clientName,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`create_appointment failed: ${message}`);
      return { status: 'error' };
    }
  }

  private hasExplicitBarberSelection(args: Record<string, unknown>) {
    const barberId = typeof args.barberId === 'string' ? args.barberId.trim() : '';
    const barberName = typeof args.barberName === 'string' ? args.barberName.trim() : '';
    return Boolean(barberId || barberName);
  }

  private normalizeIntentText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private normalizeEntityText(value: string) {
    return this.normalizeIntentText(value)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractImplicitBarberName(rawText: string) {
    if (!rawText) return '';
    const namePattern = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+";
    const multiNamePattern = `${namePattern}(?:\\s+${namePattern}){0,3}`;

    const explicitRoleMatch = rawText.match(
      new RegExp(`\\b(?:barber[oa]|peluquer[oa]|trabajador(?:a)?)\\s+(${multiNamePattern})`, 'i'),
    );
    if (explicitRoleMatch?.[1]) {
      return explicitRoleMatch[1].trim();
    }

    const conBeforeServiceMatch = rawText.match(
      new RegExp(`\\bcon\\s+(${multiNamePattern})(?=\\s+para\\s+(?:un|una|el|la)\\b)`, 'i'),
    );
    if (conBeforeServiceMatch?.[1]) {
      return conBeforeServiceMatch[1].trim();
    }

    return '';
  }

  private extractImplicitServiceName(rawText: string) {
    if (!rawText) return '';
    const namePattern = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+";
    const multiNamePattern = `${namePattern}(?:\\s+${namePattern}){0,3}`;

    const withConPatternMatch = rawText.match(
      new RegExp(
        `\\bcon\\s+(${multiNamePattern})(?=\\s+y\\s+(?:barber[oa]|peluquer[oa]|trabajador(?:a)?)\\b|\\s+y\\b|\\s*$)`,
        'i',
      ),
    );
    if (withConPatternMatch?.[1]) {
      return withConPatternMatch[1].trim();
    }

    const withParaArticleMatch = rawText.match(/\bpara\s+(?:un|una|el|la)\s+(.+?)(?:[.,;!?]|$)/i);
    if (withParaArticleMatch?.[1]) {
      return withParaArticleMatch[1].trim();
    }

    return '';
  }

  private extractImplicitUserName(rawText: string) {
    if (!rawText) return '';
    const personTokenPattern =
      "(?!(?:para|manana|hoy|pasado|este|esta|con|y|el|la|los|las|un|una)\\b)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+";
    const userNamePattern = `${personTokenPattern}(?:\\s+${personTokenPattern}){0,3}`;
    const userMatch = rawText.match(
      new RegExp(
        `\\bpara\\s+(${userNamePattern})(?=\\s+(?:para|el|la|los|las|a\\s+las|con|y|hoy|manana|pasado|este|esta)\\b|\\s*$)`,
        'i',
      ),
    );
    return userMatch?.[1]?.trim() || '';
  }

  private applyEntityInferenceFromRawText(args: Record<string, unknown>, rawText: string) {
    if (!rawText) return;

    const inferredUserName = this.extractImplicitUserName(rawText);
    const inferredBarberName = this.extractImplicitBarberName(rawText);
    const inferredServiceName = this.extractImplicitServiceName(rawText);

    const hasExplicitServiceId = typeof args.serviceId === 'string' && args.serviceId.trim().length > 0;
    const currentUserName = typeof args.userName === 'string' ? args.userName.trim() : '';

    if (inferredUserName && !currentUserName) {
      args.userName = inferredUserName;
    }
    if (inferredBarberName) {
      args.barberName = inferredBarberName;
    }
    if (!hasExplicitServiceId && inferredServiceName) {
      args.serviceName = inferredServiceName;
    }
  }

  private isOverlappingNormalizedEntity(left: string, right: string) {
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left);
  }

  private async sanitizeUntrustedBarberSelection(args: Record<string, unknown>, rawText: string) {
    const normalizedRawText = this.normalizeEntityText(rawText || '');
    if (!normalizedRawText) return;

    const userName = typeof args.userName === 'string' ? args.userName.trim() : '';
    const normalizedUserName = this.normalizeEntityText(userName);
    const hasStaffKeyword = /\b(barber[oa]?|barbero|barbera|peluquer[oa]|trabajador(?:a)?|emplead(?:o|a))\b/.test(
      normalizedRawText,
    );
    const isTrustedBarberMention = (name: string) => {
      const normalizedBarberName = this.normalizeEntityText(name);
      if (!normalizedBarberName) return false;
      const mentionedByCon = normalizedRawText.includes(`con ${normalizedBarberName}`);
      const mentionedByKeyword = hasStaffKeyword && normalizedRawText.includes(normalizedBarberName);
      const mentionedByPara = normalizedRawText.includes(`para ${normalizedBarberName}`);
      const nameMentioned = normalizedRawText.includes(normalizedBarberName);
      const sameAsUser = Boolean(normalizedUserName) && normalizedUserName === normalizedBarberName;
      const looksLikeClientMention = mentionedByPara || sameAsUser;
      const barberSelectionTrusted = mentionedByCon || mentionedByKeyword;
      return barberSelectionTrusted && nameMentioned && !looksLikeClientMention;
    };

    const barberId = typeof args.barberId === 'string' ? args.barberId.trim() : '';
    if (barberId) {
      const barber = await this.aiToolsReadPort.findBarberNameById({
        localId: this.getLocalId(),
        barberId,
      });
      if (!barber || !isTrustedBarberMention(barber.name)) {
        delete args.barberId;
      }
    }

    const barberName = typeof args.barberName === 'string' ? args.barberName.trim() : '';
    if (barberName && !isTrustedBarberMention(barberName)) {
      delete args.barberName;
    }
  }

  private async sanitizeUntrustedServiceSelection(args: Record<string, unknown>, rawText: string) {
    const inferredServiceName = this.extractImplicitServiceName(rawText || '');
    const normalizedInferredServiceName = this.normalizeEntityText(inferredServiceName);

    const serviceId = typeof args.serviceId === 'string' ? args.serviceId.trim() : '';
    if (serviceId) {
      const service = await this.aiToolsReadPort.findServiceById({
        localId: this.getLocalId(),
        serviceId,
      });
      if (!service) {
        delete args.serviceId;
      } else if (normalizedInferredServiceName) {
        const normalizedServiceName = this.normalizeEntityText(service.name);
        if (!this.isOverlappingNormalizedEntity(normalizedServiceName, normalizedInferredServiceName)) {
          delete args.serviceId;
        }
      }
    }

    if (normalizedInferredServiceName) {
      const currentServiceName = typeof args.serviceName === 'string' ? args.serviceName.trim() : '';
      const normalizedCurrentServiceName = this.normalizeEntityText(currentServiceName);
      if (!normalizedCurrentServiceName) {
        args.serviceName = inferredServiceName;
      } else if (!this.isOverlappingNormalizedEntity(normalizedCurrentServiceName, normalizedInferredServiceName)) {
        args.serviceName = inferredServiceName;
      }
    }
  }

  private extractDayPeriod(normalizedText: string): DayPeriod | null {
    if (/\b(?:por|de)\s+la\s+manana\b/.test(normalizedText)) return 'morning';
    if (/\b(?:por|de)\s+la\s+tarde\b/.test(normalizedText)) return 'afternoon';
    if (/\b(?:por|de)\s+la\s+noche\b/.test(normalizedText)) return 'night';
    return null;
  }

  private isSoonestRequest(normalizedText: string) {
    return /\b(lo antes posible|cuanto antes|en cuanto puedas|primer hueco|primera hora disponible|lo mas pronto posible)\b/.test(
      normalizedText,
    );
  }

  private timeToMinutes(slot: string) {
    const [hour, minute] = slot.split(':').map((value) => Number(value));
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return -1;
    return hour * 60 + minute;
  }

  private isSlotInDayPeriod(slot: string, period: DayPeriod | null) {
    if (!period) return true;
    const minutes = this.timeToMinutes(slot);
    if (minutes < 0) return false;
    if (period === 'morning') return minutes >= 6 * 60 && minutes < 14 * 60;
    if (period === 'afternoon') return minutes >= 14 * 60 && minutes < 21 * 60;
    return minutes >= 21 * 60;
  }

  private getCurrentWeekRange(now: Date, timeZone: string) {
    const today = getDateStringInTimeZone(now, timeZone);
    const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
    const offsetByDay: Record<string, number> = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };
    const offset = offsetByDay[weekdayShort] ?? 0;
    const weekStart = getDateStringInTimeZone(addDays(parseDateString(today), -offset), timeZone);
    const weekEnd = getDateStringInTimeZone(addDays(parseDateString(weekStart), 6), timeZone);
    return { weekStart, weekEnd };
  }

  private async getWeeklyLoadByBarber(
    barberIds: string[],
    context: AiToolContext,
  ): Promise<Record<string, number>> {
    const uniqueBarberIds = Array.from(new Set(barberIds.filter(Boolean)));
    const empty = Object.fromEntries(uniqueBarberIds.map((barberId) => [barberId, 0]));
    if (uniqueBarberIds.length === 0) return empty;
    try {
      const { weekStart, weekEnd } = this.getCurrentWeekRange(context.now, context.timeZone);
      const weeklyLoad = await this.bookingToolPort.getWeeklyLoad(weekStart, weekEnd, uniqueBarberIds);
      return { ...empty, ...(weeklyLoad.counts || {}) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo calcular la carga semanal de barberos: ${message}`);
      return empty;
    }
  }

  private pickLeastLoadedBarber<T extends { id: string; name: string }>(
    barbers: T[],
    loadByBarber: Record<string, number>,
  ) {
    return [...barbers].sort((a, b) => {
      const loadA = loadByBarber[a.id] ?? 0;
      const loadB = loadByBarber[b.id] ?? 0;
      if (loadA !== loadB) return loadA - loadB;
      return a.name.localeCompare(b.name, 'es');
    })[0];
  }

  private async getSlotsByDateForBarbers(
    date: string,
    barberIds: string[],
    serviceId: string,
  ): Promise<Record<string, string[]>> {
    const uniqueBarberIds = Array.from(new Set(barberIds.filter(Boolean)));
    if (uniqueBarberIds.length === 0) return {};
    const chunkSize = 30;
    const combined: Record<string, string[]> = {};
    for (let index = 0; index < uniqueBarberIds.length; index += chunkSize) {
      const chunk = uniqueBarberIds.slice(index, index + chunkSize);
      const response = await this.bookingToolPort.getAvailableSlotsBatch(date, chunk, { serviceId });
      Object.assign(combined, response);
    }
    return combined;
  }

  private async getActiveBarbers() {
    return this.aiToolsReadPort.findActiveBarbers({
      localId: this.getLocalId(),
    });
  }

  private async resolveBarberAndSlot(params: {
    context: AiToolContext;
    barbers: Array<{ id: string; name: string }>;
    serviceId: string;
    date: string | null;
    time: string | null;
    dayPeriod: DayPeriod | null;
    wantsSoonest: boolean;
  }): Promise<
    | { status: 'ok'; barber: { id: string; name: string }; date: string; time: string }
    | { status: 'failed'; result: AiCreateAppointmentResult }
  > {
    const { context, barbers, serviceId, date, time, dayPeriod, wantsSoonest } = params;
    const todayDate = getDateStringInTimeZone(context.now, context.timeZone);
    const nowMinutes = this.timeToMinutes(formatTimeInTimeZone(context.now, context.timeZone));
    const loadByBarber = await this.getWeeklyLoadByBarber(
      barbers.map((barber) => barber.id),
      context,
    );
    const barberById = new Map(barbers.map((barber) => [barber.id, barber]));

    if (date && time) {
      const slotsByBarber = await this.getSlotsByDateForBarbers(date, barbers.map((barber) => barber.id), serviceId);
      const availableBarbers = barbers.filter((barber) => {
        const slots = slotsByBarber[barber.id] || [];
        return slots.includes(time);
      });
      if (availableBarbers.length === 0) {
        return { status: 'failed', result: { status: 'unavailable', reason: 'slot_unavailable' } };
      }
      const chosen = this.pickLeastLoadedBarber(availableBarbers, loadByBarber);
      return { status: 'ok', barber: chosen, date, time };
    }

    const startDate = date || todayDate;
    const endDate = date
      ? date
      : getDateStringInTimeZone(addDays(parseDateString(startDate), AUTO_SLOT_SEARCH_DAYS), context.timeZone);

    for (const dateCandidate of this.buildDateRange(startDate, endDate, context.timeZone)) {
      const slotsByBarber = await this.getSlotsByDateForBarbers(
        dateCandidate,
        barbers.map((barber) => barber.id),
        serviceId,
      );
      const candidates: Array<{ barberId: string; slot: string }> = [];
      for (const barber of barbers) {
        const slots = (slotsByBarber[barber.id] || []).filter((slot) => this.isSlotInDayPeriod(slot, dayPeriod));
        const filteredByNow =
          dateCandidate === todayDate
            ? slots.filter((slot) => this.timeToMinutes(slot) > nowMinutes)
            : slots;
        if (filteredByNow.length === 0) continue;
        candidates.push({ barberId: barber.id, slot: filteredByNow[0] });
      }
      if (candidates.length === 0) {
        continue;
      }
      const rankedCandidates = candidates
        .map((candidate) => {
          const barber = barberById.get(candidate.barberId);
          if (!barber) return null;
          return { barber, slot: candidate.slot };
        })
        .filter((candidate): candidate is { barber: { id: string; name: string }; slot: string } => Boolean(candidate))
        .sort((a, b) => {
          const loadA = loadByBarber[a.barber.id] ?? 0;
          const loadB = loadByBarber[b.barber.id] ?? 0;
          if (loadA !== loadB) return loadA - loadB;
          const timeDiff = this.timeToMinutes(a.slot) - this.timeToMinutes(b.slot);
          if (timeDiff !== 0) return timeDiff;
          return a.barber.name.localeCompare(b.barber.name, 'es');
        });
      const chosen = rankedCandidates[0];
      if (!chosen) {
        continue;
      }
      return {
        status: 'ok',
        barber: chosen.barber,
        date: dateCandidate,
        time: chosen.slot,
      };
    }

    return {
      status: 'failed',
      result: {
        status: 'unavailable',
        reason: wantsSoonest || dayPeriod || !time ? 'slot_window_unavailable' : 'slot_unavailable',
      },
    };
  }

  private async isGeneralHolidayDate(date: string) {
    try {
      const holidays = await this.holidayToolPort.getGeneralHolidays();
      return holidays.some((holiday) => date >= holiday.start && date <= holiday.end);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo validar festivos generales para ${date}: ${message}`);
      return false;
    }
  }

  private buildDateRange(startDate: string, endDate: string, timeZone: string) {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    const ordered = start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
    const totalDays = Math.floor((ordered.end.getTime() - ordered.start.getTime()) / (24 * 60 * 60 * 1000));
    return Array.from({ length: totalDays + 1 }).map((_, index) =>
      getDateStringInTimeZone(addDays(ordered.start, index), timeZone),
    );
  }

  private async resolveBarber(args: Record<string, unknown>): Promise<
    | { status: 'ok'; barber: { id: string; name: string } }
    | { status: 'needs_info'; result: AiCreateAppointmentResult }
  > {
    const barberId = typeof args.barberId === 'string' ? args.barberId : '';
    const barberName = typeof args.barberName === 'string' ? args.barberName.trim() : '';

    if (barberId) {
      const barber = await this.aiToolsReadPort.findBarberById({
        localId: this.getLocalId(),
        barberId,
      });
      if (!barber || barber.isActive === false) {
        return {
          status: 'needs_info',
          result: {
            status: 'needs_info',
            missing: ['barberId'],
            reason: barber ? 'barber_inactive' : undefined,
          },
        };
      }
      return { status: 'ok', barber: { id: barber.id, name: barber.name } };
    }

    if (!barberName) {
      return {
        status: 'needs_info',
        result: { status: 'needs_info', missing: ['barberName'] },
      };
    }

    const barbers = await this.aiToolsReadPort.findBarbersByName({
      localId: this.getLocalId(),
      name: barberName,
      isActive: true,
      take: 5,
    });

    if (barbers.length === 1) {
      return { status: 'ok', barber: barbers[0] };
    }

    if (barbers.length === 0) {
      const inactiveMatches = await this.aiToolsReadPort.findBarbersByName({
        localId: this.getLocalId(),
        name: barberName,
        isActive: false,
        take: 1,
      });
      if (inactiveMatches.length > 0) {
        return {
          status: 'needs_info',
          result: { status: 'needs_info', missing: ['barberName'], reason: 'barber_inactive' },
        };
      }
    }

    return {
      status: 'needs_info',
      result: {
        status: 'needs_info',
        missing: ['barberId'],
        options: { barbers },
      },
    };
  }

  private async resolveService(args: Record<string, unknown>): Promise<
    | { status: 'ok'; service: { id: string; name: string; duration: number } }
    | { status: 'needs_info'; result: AiCreateAppointmentResult }
  > {
    const serviceId = typeof args.serviceId === 'string' ? args.serviceId : '';
    const serviceName = typeof args.serviceName === 'string' ? args.serviceName.trim() : '';
    const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';
    const localId = this.getLocalId();

    const normalizeLookupText = (value: string) =>
      this.normalizeIntentText(value)
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stopWords = new Set([
      'de',
      'del',
      'la',
      'el',
      'los',
      'las',
      'un',
      'una',
      'con',
      'para',
      'servicio',
      'cita',
      'cliente',
    ]);
    const matchServiceFromRawText = async () => {
      if (!rawText) return { kind: 'none' as const };
      const normalizedRaw = normalizeLookupText(rawText);
      if (!normalizedRaw) return { kind: 'none' as const };
      const servicesCatalog = await this.aiToolsReadPort.findServicesCatalog({ localId });
      if (servicesCatalog.length === 0) return { kind: 'none' as const };
      const matched = servicesCatalog.filter((service) => {
        const normalizedName = normalizeLookupText(service.name);
        if (!normalizedName) return false;
        if (normalizedRaw.includes(normalizedName)) return true;
        const tokens = normalizedName
          .split(' ')
          .map((token) => token.trim())
          .filter((token) => token.length >= 3 && !stopWords.has(token));
        if (tokens.length === 0) return false;
        const hits = tokens.filter((token) => new RegExp(`\\b${escapeRegExp(token)}\\b`).test(normalizedRaw)).length;
        return hits === tokens.length || (tokens.length > 1 && hits >= 2);
      });
      if (matched.length === 1) {
        return { kind: 'single' as const, service: matched[0] };
      }
      if (matched.length > 1) {
        return { kind: 'multiple' as const, services: matched.slice(0, 5) };
      }
      return { kind: 'none' as const };
    };

    if (serviceId) {
      const service = await this.aiToolsReadPort.findServiceById({ localId, serviceId });
      if (!service) {
        delete args.serviceId;
      } else {
        return { status: 'ok', service };
      }
    }

    if (!serviceName) {
      const rawMatch = await matchServiceFromRawText();
      if (rawMatch.kind === 'single') {
        return { status: 'ok', service: rawMatch.service };
      }
      if (rawMatch.kind === 'multiple') {
        return {
          status: 'needs_info',
          result: {
            status: 'needs_info',
            missing: ['serviceId'],
            options: { services: rawMatch.services },
          },
        };
      }
      return {
        status: 'needs_info',
        result: { status: 'needs_info', missing: ['serviceName'] },
      };
    }

    const services = await this.aiToolsReadPort.findServicesByName({
      localId,
      name: serviceName,
      take: 5,
    });

    if (services.length === 1) {
      return { status: 'ok', service: services[0] };
    }

    if (services.length === 0) {
      const rawMatch = await matchServiceFromRawText();
      if (rawMatch.kind === 'single') {
        return { status: 'ok', service: rawMatch.service };
      }
      if (rawMatch.kind === 'multiple') {
        return {
          status: 'needs_info',
          result: {
            status: 'needs_info',
            missing: ['serviceId'],
            options: { services: rawMatch.services },
          },
        };
      }
    }

    return {
      status: 'needs_info',
      result: {
        status: 'needs_info',
        missing: ['serviceId'],
        options: { services },
      },
    };
  }

  private async resolveUser(args: Record<string, unknown>): Promise<
    | {
        status: 'ok';
        userId?: string;
        guestName?: string;
        guestContact?: string;
        clientName?: string;
      }
    | { status: 'needs_info'; result: AiCreateAppointmentResult }
  > {
    const brandId = this.getBrandId();
    const userEmail = typeof args.userEmail === 'string' ? args.userEmail.trim().toLowerCase() : '';
    const userPhone = typeof args.userPhone === 'string' ? args.userPhone.trim() : '';
    const userName = typeof args.userName === 'string' ? args.userName.trim() : '';
    const normalizePersonName = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (userEmail) {
      const user = await this.aiToolsReadPort.findClientByEmail({
        brandId,
        email: userEmail,
      });
      if (user) {
        return { status: 'ok', userId: user.id, clientName: user.name };
      }
      return {
        status: 'ok',
        guestName: userName || 'Invitado',
        guestContact: userEmail,
        clientName: userName || 'Invitado',
      };
    }

    if (userPhone) {
      const user = await this.aiToolsReadPort.findClientByPhone({
        brandId,
        phone: userPhone,
      });
      if (user) {
        return { status: 'ok', userId: user.id, clientName: user.name };
      }
      return {
        status: 'ok',
        guestName: userName || 'Invitado',
        guestContact: userPhone,
        clientName: userName || 'Invitado',
      };
    }

    if (!userName) {
      return {
        status: 'needs_info',
        result: { status: 'needs_info', missing: ['userName'] },
      };
    }

    const normalizedInputName = normalizePersonName(userName);
    const normalizedTokens = normalizedInputName.split(' ').filter(Boolean);
    const broadLookupName = normalizedTokens.slice(0, Math.min(2, normalizedTokens.length)).join(' ');
    const lookupTerms = Array.from(new Set([userName, broadLookupName].map((value) => value.trim()).filter(Boolean)));
    const users = await this.aiToolsReadPort.findClientsByNameTerms({
      brandId,
      terms: lookupTerms,
      take: 15,
    });

    const isOverlappingNameMatch = (candidateName: string) => {
      const normalizedCandidateName = normalizePersonName(candidateName);
      if (!normalizedCandidateName) return false;
      if (normalizedCandidateName === normalizedInputName) return true;
      return (
        normalizedCandidateName.startsWith(normalizedInputName)
        || normalizedInputName.startsWith(normalizedCandidateName)
      );
    };

    const overlappingNameMatches = users.filter((user) => isOverlappingNameMatch(user.name));

    if (overlappingNameMatches.length > 1) {
      return {
        status: 'needs_info',
        result: {
          status: 'needs_info',
          missing: ['userEmail'],
          reason: 'user_ambiguous',
          matchCount: overlappingNameMatches.length,
          options: {
            users: overlappingNameMatches.slice(0, 5),
          },
        },
      };
    }

    if (overlappingNameMatches.length === 1) {
      return { status: 'ok', userId: overlappingNameMatches[0].id, clientName: overlappingNameMatches[0].name };
    }

    if (users.length === 0) {
      return {
        status: 'ok',
        guestName: userName,
        clientName: userName,
      };
    }

    return {
      status: 'ok',
      guestName: userName,
      clientName: userName,
    };
  }

  private normalizeAlertType(input: string): AlertType | null {
    const value = input.trim().toLowerCase();
    if (!value) return null;
    if (value === 'success' || value === 'exito' || value === 'éxito') return AlertType.success;
    if (value === 'warning' || value === 'advertencia') return AlertType.warning;
    if (value === 'info' || value === 'informacion' || value === 'información') return AlertType.info;
    return null;
  }

  private parseDurationDays(normalizedText: string): number | null {
    if (!normalizedText) return null;
    const match = normalizedText.match(
      /\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|\d+)\s+(dia|dias|semana|semanas|mes|meses)\b/,
    );
    if (!match) return null;
    const amountToken = match[1];
    const unit = match[2];
    const amountWords: Record<string, number> = {
      un: 1,
      una: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10,
      once: 11,
      doce: 12,
      quince: 15,
      veinte: 20,
    };
    const parsedAmount = /^\d+$/.test(amountToken) ? Number(amountToken) : (amountWords[amountToken] ?? 0);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
    if (unit.startsWith('dia')) return parsedAmount;
    if (unit.startsWith('semana')) return parsedAmount * 7;
    return parsedAmount * 30;
  }

  private parseDateAfterPattern(
    input: string,
    pattern: RegExp,
    context: AiToolContext,
  ): string | null {
    const match = input.match(pattern);
    if (!match?.[1]) return null;
    const candidate = match[1].trim();
    if (!candidate) return null;
    return parseDateFromText(candidate, context.now, context.timeZone);
  }

  private resolveAlertSchedule(
    args: Record<string, unknown>,
    context: AiToolContext,
  ): { startDate?: string; endDate?: string } {
    const startDateInput = typeof args.startDate === 'string' ? args.startDate.trim() : '';
    const endDateInput = typeof args.endDate === 'string' ? args.endDate.trim() : '';
    const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';
    let startDate = isValidDateString(startDateInput) ? startDateInput : '';
    let endDate = isValidDateString(endDateInput) ? endDateInput : '';
    if (!rawText) {
      return {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      };
    }

    const normalized = this.normalizeIntentText(rawText);
    const today = getDateStringInTimeZone(context.now, context.timeZone);
    const hasFromExpression = /\b(a partir de|desde)\b/.test(normalized);
    const durationDays = this.parseDurationDays(normalized);
    const startFromConnector =
      this.parseDateAfterPattern(rawText, /\b(?:a partir de|desde)\s+([^.,;]+)/i, context)
      || this.parseDateAfterPattern(rawText, /\b(?:a partir del?|desde el?)\s+([^.,;]+)/i, context);
    const endFromUntil = this.parseDateAfterPattern(rawText, /\bhasta\s+([^.,;]+)/i, context);
    const singleDateFromText = parseDateFromText(rawText, context.now, context.timeZone);
    const rangeFromText = parseDateRangeFromText(rawText, context.now, context.timeZone);

    if (!startDate && startFromConnector) {
      startDate = startFromConnector;
    }
    if (!startDate && singleDateFromText) {
      startDate = singleDateFromText;
    }
    if (!endDate && endFromUntil) {
      endDate = endFromUntil;
    }

    if (durationDays) {
      const baseStart = startDate || startFromConnector || singleDateFromText || today;
      const parsedStart = parseDateString(baseStart);
      startDate = getDateStringInTimeZone(parsedStart, context.timeZone);
      const computedEnd = addDays(parsedStart, Math.max(0, durationDays - 1));
      endDate = getDateStringInTimeZone(computedEnd, context.timeZone);
    }

    const shouldUseRangeFallback = !hasFromExpression || Boolean(durationDays) || Boolean(endFromUntil);
    if (rangeFromText && shouldUseRangeFallback) {
      if (!startDate) startDate = rangeFromText.start;
      if (!endDate) endDate = rangeFromText.end;
    }

    if (!startDate && endDate) {
      startDate = today;
    }

    if (startDate && endDate && parseDateString(startDate).getTime() > parseDateString(endDate).getTime()) {
      [startDate, endDate] = [endDate, startDate];
    }

    return {
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
  }

  private async createAlert(args: Record<string, unknown>, context: AiToolContext): Promise<AiCreateAlertResult> {
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    const message = typeof args.message === 'string' ? args.message.trim() : '';
    const typeRaw = typeof args.type === 'string' ? args.type : '';
    const type = this.normalizeAlertType(typeRaw);
    const active = typeof args.active === 'boolean' ? args.active : true;

    if (!title || !message || !type) {
      const missing: string[] = [];
      if (!title) missing.push('title');
      if (!message) missing.push('message');
      if (!type) missing.push('type');
      return { status: 'needs_info', missing };
    }

    try {
      const schedule = this.resolveAlertSchedule(args, context);
      const created = await this.alertToolPort.createAlert({
        title,
        message,
        type,
        active,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
      });

      return {
        status: 'created',
        alertId: created.id,
        title: created.title,
        message: created.message,
        type: created.type,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`create_alert failed: ${errorMessage}`);
      return { status: 'error' };
    }
  }
}
