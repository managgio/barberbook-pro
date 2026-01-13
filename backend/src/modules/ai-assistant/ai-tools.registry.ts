import { Injectable } from '@nestjs/common';
import type OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { HolidaysService } from '../holidays/holidays.service';
import {
  formatTimeInTimeZone,
  getDateStringInTimeZone,
  isValidDateString,
  parseDateFromText,
  parseDateRangeFromText,
  parseTimeFromText,
  toDateInTimeZone,
} from './ai-assistant.utils';
import { AiCreateAppointmentResult, AiHolidayActionResult, AiToolContext, AiToolName } from './ai-assistant.types';

const TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: 'Crea una cita nueva tras validar disponibilidad y horario.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
          time: { type: 'string', description: 'Hora HH:mm.' },
          dateText: { type: 'string', description: 'Fecha en lenguaje natural (ej: 12 de enero).' },
          timeText: { type: 'string', description: 'Hora en lenguaje natural (ej: 18:00).' },
          rawText: { type: 'string', description: 'Texto original del usuario para interpretar fecha/hora.' },
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
];

@Injectable()
export class AiToolsRegistry {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly holidaysService: HolidaysService,
  ) {}

  getTools() {
    return TOOL_DEFINITIONS;
  }

  async execute(toolName: AiToolName, args: Record<string, unknown>, context: AiToolContext) {
    switch (toolName) {
      case 'create_appointment':
        return this.createAppointment(args, context);
      case 'add_shop_holiday':
        return this.addShopHoliday(args, context);
      case 'add_barber_holiday':
        return this.addBarberHoliday(args, context);
      default:
        throw new Error(`Tool no soportada: ${toolName}`);
    }
  }

  private async addShopHoliday(args: Record<string, unknown>, context: AiToolContext): Promise<AiHolidayActionResult> {
    const startDateInput = typeof args.startDate === 'string' ? args.startDate.trim() : '';
    const endDateInput = typeof args.endDate === 'string' ? args.endDate.trim() : '';
    const dateText = typeof args.dateText === 'string' ? args.dateText.trim() : '';
    const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';

    let startDate = isValidDateString(startDateInput) ? startDateInput : '';
    let endDate = isValidDateString(endDateInput) ? endDateInput : '';

    if (!startDate) {
      const rangeText = [dateText, rawText].filter(Boolean).join(' ');
      const parsedRange = parseDateRangeFromText(rangeText, context.now, context.timeZone);
      if (parsedRange) {
        startDate = parsedRange.start;
        endDate = parsedRange.end;
      }
    }

    if (!startDate) {
      return { status: 'needs_info', scope: 'shop', missing: ['startDate'] };
    }

    if (!endDate) {
      endDate = startDate;
    }

    await this.holidaysService.addGeneralHoliday({ start: startDate, end: endDate });
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

    if (!startDate) {
      const rangeText = [dateText, rawText].filter(Boolean).join(' ');
      const parsedRange = parseDateRangeFromText(rangeText, context.now, context.timeZone);
      if (parsedRange) {
        startDate = parsedRange.start;
        endDate = parsedRange.end;
      }
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
      const barbers = await this.prisma.barber.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      barberIds = barbers.map((barber) => barber.id);
    }

    if (barberIds.length > 0) {
      const existing = await this.prisma.barber.findMany({
        where: { id: { in: barberIds } },
        select: { id: true, name: true, isActive: true },
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
          const matches = await this.prisma.barber.findMany({
            where: { name: { contains: candidate } },
            take: 5,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, isActive: true },
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
      await this.holidaysService.addBarberHoliday(barberId, { start: startDate, end: endDate });
    }

    const barberNames = await this.prisma.barber.findMany({
      where: { id: { in: barberIds } },
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    return {
      status: 'added',
      scope: 'barber',
      range: { start: startDate, end: endDate },
      barberIds,
      barberNames: barberNames.map((barber) => barber.name),
      added: barberIds.length,
    };
  }

  private async createAppointment(
    args: Record<string, unknown>,
    context: AiToolContext,
  ): Promise<AiCreateAppointmentResult> {
    const dateInput = typeof args.date === 'string' ? args.date.trim() : '';
    const timeInput = typeof args.time === 'string' ? args.time.trim() : '';
    const startDateTimeInput = typeof args.startDateTime === 'string' ? args.startDateTime.trim() : '';
    const dateText = typeof args.dateText === 'string' ? args.dateText.trim() : '';
    const timeText = typeof args.timeText === 'string' ? args.timeText.trim() : '';
    const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';

    if (rawText) {
      const namePattern = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+";
      const multiNamePattern = `${namePattern}(?:\\s+${namePattern}){0,3}`;
      if (typeof args.barberName !== 'string' || !args.barberName.trim()) {
        const barberMatch = rawText.match(
          new RegExp(`\\b(?:barber[oa]|peluquer[oa]|trabajador(?:a)?)\\s+(${multiNamePattern})`, 'i'),
        );
        if (barberMatch?.[1]) {
          args.barberName = barberMatch[1].trim();
        }
      }
      if (typeof args.serviceName !== 'string' || !args.serviceName.trim()) {
        const serviceMatch = rawText.match(
          new RegExp(
            `\\bcon\\s+(${multiNamePattern})(?=\\s+y\\s+(?:barber[oa]|peluquer[oa]|trabajador(?:a)?)\\b|\\s+y\\b|\\s*$)`,
            'i',
          ),
        );
        if (serviceMatch?.[1]) {
          args.serviceName = serviceMatch[1].trim();
        }
      }
      if (typeof args.userName !== 'string' || !args.userName.trim()) {
        const userMatch = rawText.match(
          new RegExp(
            `\\bpara\\s+(${multiNamePattern})(?=\\s+el\\b|\\s+a\\s+las\\b|\\s+con\\b|\\s+y\\b|\\s*$)`,
            'i',
          ),
        );
        if (userMatch?.[1]) {
          args.userName = userMatch[1].trim();
        }
      }
    }

    let date = '';
    let time = '';
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
    if (time) {
      time = time.slice(0, 5);
    }
    if (!date || !time || !/^\d{2}:\d{2}$/.test(time)) {
      return { status: 'needs_info', missing: ['date', 'time'] };
    }

    const barberResult = await this.resolveBarber(args);
    if (barberResult.status !== 'ok') {
      return barberResult.result;
    }
    const serviceResult = await this.resolveService(args);
    if (serviceResult.status !== 'ok') {
      return serviceResult.result;
    }

    const userResult = await this.resolveUser(args);
    if (userResult.status !== 'ok') {
      return userResult.result;
    }

    const availableSlots = await this.appointmentsService.getAvailableSlots(
      barberResult.barber.id,
      date,
      { serviceId: serviceResult.service.id },
    );
    if (!availableSlots.includes(time)) {
      return {
        status: 'unavailable',
        reason: 'slot_unavailable',
        barberId: barberResult.barber.id,
        serviceId: serviceResult.service.id,
      };
    }

    const startDateTime = toDateInTimeZone(date, time, context.timeZone);
    const created = await this.appointmentsService.create({
      barberId: barberResult.barber.id,
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
      barberId: barberResult.barber.id,
      barberName: barberResult.barber.name,
      serviceId: serviceResult.service.id,
      serviceName: serviceResult.service.name,
      userType: userResult.userId ? 'registered' : 'guest',
      guestName: userResult.userId ? undefined : userResult.guestName,
      clientName: userResult.clientName,
    };
  }

  private async resolveBarber(args: Record<string, unknown>): Promise<
    | { status: 'ok'; barber: { id: string; name: string } }
    | { status: 'needs_info'; result: AiCreateAppointmentResult }
  > {
    const barberId = typeof args.barberId === 'string' ? args.barberId : '';
    const barberName = typeof args.barberName === 'string' ? args.barberName.trim() : '';

    if (barberId) {
      const barber = await this.prisma.barber.findUnique({
        where: { id: barberId },
        select: { id: true, name: true, isActive: true },
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

    const barbers = await this.prisma.barber.findMany({
      where: { name: { contains: barberName }, isActive: true },
      take: 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    if (barbers.length === 1) {
      return { status: 'ok', barber: barbers[0] };
    }

    if (barbers.length === 0) {
      const inactiveMatches = await this.prisma.barber.findMany({
        where: { name: { contains: barberName }, isActive: false },
        take: 1,
        select: { id: true, name: true },
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

    if (serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { id: true, name: true, duration: true },
      });
      if (!service) {
        return {
          status: 'needs_info',
          result: { status: 'needs_info', missing: ['serviceId'] },
        };
      }
      return { status: 'ok', service };
    }

    if (!serviceName) {
      return {
        status: 'needs_info',
        result: { status: 'needs_info', missing: ['serviceName'] },
      };
    }

    const services = await this.prisma.service.findMany({
      where: { name: { contains: serviceName } },
      take: 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, duration: true },
    });

    if (services.length === 1) {
      return { status: 'ok', service: services[0] };
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
    const userEmail = typeof args.userEmail === 'string' ? args.userEmail.trim().toLowerCase() : '';
    const userPhone = typeof args.userPhone === 'string' ? args.userPhone.trim() : '';
    const userName = typeof args.userName === 'string' ? args.userName.trim() : '';

    if (userEmail) {
      const user = await this.prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, name: true },
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
      const user = await this.prisma.user.findFirst({
        where: { phone: userPhone },
        select: { id: true, name: true },
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

    const users = await this.prisma.user.findMany({
      where: {
        name: { contains: userName },
        role: 'client',
      },
      select: { id: true, name: true },
      take: 3,
    });

    if (users.length === 1) {
      return { status: 'ok', userId: users[0].id, clientName: users[0].name };
    }

    if (users.length === 0) {
      return {
        status: 'ok',
        guestName: userName,
        clientName: userName,
      };
    }

    return {
      status: 'needs_info',
      result: {
        status: 'needs_info',
        missing: ['userEmail'],
        matchCount: users.length,
      },
    };
  }
}
