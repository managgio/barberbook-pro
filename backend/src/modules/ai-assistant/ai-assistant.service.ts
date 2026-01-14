import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { PrismaService } from '../../prisma/prisma.service';
import { AiMemoryService } from './ai-memory.service';
import { AiToolsRegistry } from './ai-tools.registry';
import { AI_SYSTEM_PROMPT, buildSummaryPrompt } from './ai-assistant.prompt';
import { AiCreateAppointmentResult, AiHolidayActionResult, AiToolName } from './ai-assistant.types';
import { AI_TIME_ZONE, formatTimeInTimeZone, getDateStringInTimeZone } from './ai-assistant.utils';

const MAX_HISTORY_MESSAGES = 16;
const SUMMARY_EVERY_MESSAGES = 8;
const SUMMARY_MAX_MESSAGES = 10;

export interface AiChatResult {
  sessionId: string;
  assistantMessage: string;
  actions?: {
    appointmentsChanged?: boolean;
    holidaysChanged?: boolean;
  };
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private client: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly memory: AiMemoryService,
    private readonly toolsRegistry: AiToolsRegistry,
  ) {}

  async chat(adminUserId: string, message: string, sessionId?: string | null): Promise<AiChatResult> {
    await this.ensureAdminUser(adminUserId);

    const session = await this.memory.getOrCreateSession(adminUserId, sessionId);
    await this.memory.appendMessage({
      sessionId: session.id,
      role: 'user',
      content: message.trim(),
    });

    const summary = await this.memory.getSummary(session.id);
    const facts = await this.memory.getFacts(10);
    const recentMessages = await this.memory.getRecentMessages(session.id, MAX_HISTORY_MESSAGES);

    const now = new Date();
    const nowDate = getDateStringInTimeZone(now, AI_TIME_ZONE);
    const nowTime = formatTimeInTimeZone(now, AI_TIME_ZONE);

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'system', content: `Fecha actual: ${nowDate}. Hora actual: ${nowTime}. Zona horaria: ${AI_TIME_ZONE}.` },
    ];

    if (summary) {
      messages.push({ role: 'system', content: `Resumen de sesión:\n${summary}` });
    }

    if (facts.length) {
      const factsText = facts
        .map((fact) => `- ${fact.key}: ${fact.value}`)
        .join('\n');
      messages.push({ role: 'system', content: `Hechos del negocio:\n${factsText}` });
    }

    recentMessages.forEach((msg) => {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    });

    const toolDefs = this.getToolDefinitions(message);
    let assistantMessage = '';
    let appointmentsChanged = false;
    let holidaysChanged = false;
    const lastAssistantMessage = [...recentMessages].reverse().find((msg) => msg.role === 'assistant')?.content ?? '';
    const forcedTool = this.detectForcedTool(message, lastAssistantMessage);

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const completion = await this.getClient().chat.completions.create({
          model: this.getModel(),
          messages,
          tools: toolDefs,
          tool_choice: forcedTool ? { type: 'function', function: { name: forcedTool } } : 'auto',
          temperature: this.getTemperature(),
          max_tokens: this.getMaxTokens(),
        });

        const responseMessage = completion.choices[0]?.message;
        if (!responseMessage) {
          throw new ServiceUnavailableException('No se recibió respuesta del modelo');
        }

        if (responseMessage.tool_calls?.length) {
          messages.push({
            role: 'assistant',
            content: responseMessage.content ?? '',
            tool_calls: responseMessage.tool_calls,
          });

          const holidaySuccessMessages: string[] = [];
          const holidayNeedsInfoMessages: string[] = [];
          const holidayErrorMessages: string[] = [];
          let appointmentMessage: string | null = null;

          for (const toolCall of responseMessage.tool_calls) {
            const toolName = toolCall.function.name as AiToolName;
            if (!toolDefs.some((tool) => tool.function.name === toolName)) {
              throw new BadRequestException(`Tool no permitida: ${toolName}`);
            }

            let args: Record<string, unknown> = {};
            try {
              args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
            } catch (error) {
              throw new BadRequestException(`Argumentos inválidos para ${toolName}`);
            }

            if (
              toolName === 'create_appointment'
              || toolName === 'add_barber_holiday'
              || toolName === 'add_shop_holiday'
            ) {
              const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';
              if (!rawText) {
                args.rawText = message;
              }
            }

            const toolResult = await this.toolsRegistry.execute(toolName, args, {
              adminUserId,
              timeZone: AI_TIME_ZONE,
              now,
            });

            if (toolName === 'create_appointment') {
              appointmentMessage = this.buildCreateAppointmentFallback(toolResult as AiCreateAppointmentResult);
              if ((toolResult as AiCreateAppointmentResult).status === 'created') {
                appointmentsChanged = true;
              }
            }

            if (toolName === 'add_barber_holiday' || toolName === 'add_shop_holiday') {
              const holidayResult = toolResult as AiHolidayActionResult;
              if (holidayResult.status === 'added') {
                holidaysChanged = true;
              }
              const holidayMessage = this.buildHolidayResponse(holidayResult);
              if (holidayMessage) {
                if (holidayResult.status === 'needs_info') {
                  holidayNeedsInfoMessages.push(holidayMessage);
                } else if (holidayResult.status === 'error') {
                  holidayErrorMessages.push(holidayMessage);
                } else {
                  holidaySuccessMessages.push(holidayMessage);
                }
              }
            }

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult),
            });

            await this.memory.appendMessage({
              sessionId: session.id,
              role: 'tool',
              content: JSON.stringify(toolResult),
              toolName,
              toolPayload: toolResult,
            });
          }

          const responseParts = [
            ...(appointmentMessage ? [appointmentMessage] : []),
            ...holidaySuccessMessages,
            ...holidayErrorMessages,
            ...holidayNeedsInfoMessages,
          ];

          if (responseParts.length) {
            assistantMessage = responseParts.join(' ');
            break;
          }

          continue;
        }

        assistantMessage = responseMessage.content?.trim() || '';
        break;
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Fallo al procesar la conversación IA', error as Error);
      throw new ServiceUnavailableException('No se pudo completar la solicitud de IA.');
    }

    if (!assistantMessage) {
      assistantMessage = 'No pude generar una respuesta útil ahora mismo.';
    }

    assistantMessage = this.stripFormatting(assistantMessage);
    assistantMessage = this.stripUnsupportedSections(assistantMessage);

    await this.memory.appendMessage({
      sessionId: session.id,
      role: 'assistant',
      content: assistantMessage,
    });

    if (await this.memory.shouldUpdateSummary(session.id, SUMMARY_EVERY_MESSAGES)) {
      await this.updateSummary(session.id, summary);
    }

    return {
      sessionId: session.id,
      assistantMessage,
      actions:
        appointmentsChanged || holidaysChanged
          ? {
              ...(appointmentsChanged ? { appointmentsChanged } : {}),
              ...(holidaysChanged ? { holidaysChanged } : {}),
            }
          : undefined,
    };
  }

  async getSession(adminUserId: string, sessionId: string) {
    await this.ensureAdminUser(adminUserId);
    const sessionData = await this.memory.getSessionMessages(sessionId, adminUserId, 80);
    if (!sessionData) {
      throw new NotFoundException('Sesión no encontrada.');
    }
    return {
      sessionId: sessionData.session.id,
      summary: sessionData.session.summary,
      messages: sessionData.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  }

  async transcribeAudio(adminUserId: string, file?: Express.Multer.File) {
    await this.ensureAdminUser(adminUserId);
    if (!file) {
      throw new BadRequestException('Archivo de audio requerido.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('El audio supera el tamaño máximo de 10MB.');
    }
    const isAudio = file.mimetype?.startsWith('audio/');
    const isWebm = file.mimetype === 'video/webm';
    if (!isAudio && !isWebm && file.mimetype !== 'application/octet-stream') {
      throw new BadRequestException('Formato de audio no soportado.');
    }

    const audioFile = await toFile(file.buffer, file.originalname || 'audio.webm', {
      type: file.mimetype || 'audio/webm',
    });

    const response = await this.getClient().audio.transcriptions.create({
      file: audioFile,
      model: this.getTranscriptionModel(),
      language: 'es',
      temperature: 0,
    });

    return { text: response.text?.trim() || '' };
  }

  private buildCreateAppointmentFallback(result: AiCreateAppointmentResult): string | null {
    if (result.status === 'created') {
      const startDateTime = result.startDateTime ? new Date(result.startDateTime) : null;
      const dateLabel = startDateTime
        ? new Intl.DateTimeFormat('es-ES', {
            timeZone: AI_TIME_ZONE,
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(startDateTime)
        : '';
      const timeLabel = startDateTime ? formatTimeInTimeZone(startDateTime, AI_TIME_ZONE) : '';
      const parts = ['Cita creada.'];
      if (result.clientName) {
        parts.push(`Cliente: ${result.clientName}.`);
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
      return 'Ese horario no está disponible para ese barbero y servicio.';
    }
    if (result.status === 'error') {
      return 'No pude crear la cita ahora mismo.';
    }
    if (result.status === 'needs_info') {
      if (result.reason === 'barber_inactive') {
        return 'Ese barbero no está activo. Indícame otro barbero disponible.';
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
  }

  private buildHolidayResponse(result: AiHolidayActionResult): string | null {
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
  }

  private normalizeIntentText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private getIntentSignals(message: string) {
    const normalized = this.normalizeIntentText(message);
    if (!normalized) {
      return {
        normalized,
        wantsHoliday: false,
        wantsAppointment: false,
        isShop: false,
        hasBarberScope: false,
        hasMultiHolidayMarkers: false,
      };
    }

    const wantsHoliday = /\b(festiv[a-z]*|vacaci[a-z]*|cerrad[a-z]*|cerrar|cierre|no laborable)\b/.test(
      normalized,
    );
    const wantsAppointment = /\b(cita|reserv|agendar|programar)\b/.test(normalized);
    const isShop = /\b(local|salon|barberia|negocio|tienda)\b/.test(normalized);
    const mentionsBarber = /\b(barber|barbero|barbera|peluquer|estilista|trabajador(?:a)?|emplead(?:o|a)?)\b/.test(
      normalized,
    );
    const hasNamedBarber = /\bpara\s+(?!el\b|la\b|los\b|las\b|un\b|una\b|unos\b|unas\b|dia\b|fecha\b|rango\b|semana\b|mes\b|local\b|salon\b|barberia\b|negocio\b|tienda\b)[a-z]/.test(
      normalized,
    );
    const hasMultiHolidayMarkers = /\b(y otro|y otra|ademas|además)\b/.test(normalized);

    return {
      normalized,
      wantsHoliday,
      wantsAppointment,
      isShop,
      hasBarberScope: mentionsBarber || hasNamedBarber,
      hasMultiHolidayMarkers,
    };
  }

  private getToolDefinitions(message: string) {
    const tools = this.toolsRegistry.getTools();
    const intent = this.getIntentSignals(message);
    if (intent.wantsHoliday && !intent.wantsAppointment) {
      return tools.filter((tool) => tool.function.name !== 'create_appointment');
    }
    return tools;
  }

  private detectForcedTool(message: string, lastAssistantMessage?: string): AiToolName | null {
    const intent = this.getIntentSignals(message);
    const { normalized } = intent;
    if (!normalized) return null;

    if (intent.wantsHoliday) {
      if (intent.isShop && intent.hasBarberScope) return null;
      if (intent.hasBarberScope && intent.hasMultiHolidayMarkers) return null;
      if (intent.hasBarberScope) return 'add_barber_holiday';
      return 'add_shop_holiday';
    }

    if (intent.wantsAppointment) {
      return 'create_appointment';
    }

    if (!lastAssistantMessage) return null;
    const lastNormalized = this.normalizeIntentText(lastAssistantMessage);
    const askedForInfo = /\b(necesito|indicame|indícame|falta|faltan)\b/.test(lastNormalized);
    if (!askedForInfo) return null;
    if (/\bcita\b/.test(lastNormalized)) {
      return 'create_appointment';
    }
    if (/\b(festiv[a-z]*|vacaci[a-z]*|cerrad[a-z]*|cerrar|cierre)\b/.test(lastNormalized)) {
      const isShop = /\b(local|salon|barberia|negocio|tienda)\b/.test(lastNormalized);
      return isShop ? 'add_shop_holiday' : 'add_barber_holiday';
    }

    return null;
  }

  private async updateSummary(sessionId: string, previousSummary: string) {
    const recentMessages = await this.memory.getRecentMessages(sessionId, SUMMARY_MAX_MESSAGES);
    if (recentMessages.length === 0) return;

    const transcript = recentMessages.map((msg) => `${msg.role}: ${msg.content}`);
    const prompt = buildSummaryPrompt(previousSummary, transcript);

    try {
      const completion = await this.getClient().chat.completions.create({
        model: this.getModel(),
        messages: [
          { role: 'system', content: 'Eres un asistente que resume conversaciones de negocio.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
      });
      const summary = completion.choices[0]?.message?.content?.trim();
      if (summary) {
        await this.memory.updateSummary(sessionId, summary);
      }
    } catch (error) {
      this.logger.warn('No se pudo actualizar el resumen de la sesión.');
    }
  }

  private stripFormatting(text: string) {
    return text.replace(/[*_`]/g, '');
  }

  private stripUnsupportedSections(text: string) {
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
  }

  private async ensureAdminUser(adminUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: adminUserId } });
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Usuario admin inválido.');
    }
  }

  private getClient() {
    if (this.client) return this.client;
    const provider = this.configService.get<string>('AI_PROVIDER') || 'openai';
    if (provider !== 'openai') {
      throw new BadRequestException('Proveedor IA no soportado.');
    }
    const apiKey = this.configService.get<string>('AI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Falta AI_API_KEY en el entorno.');
    }
    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  private getModel() {
    return this.configService.get<string>('AI_MODEL') || 'gpt-4o-mini';
  }

  private getMaxTokens() {
    const raw = this.configService.get<string>('AI_MAX_TOKENS');
    const parsed = raw ? Number(raw) : 800;
    return Number.isFinite(parsed) ? parsed : 800;
  }

  private getTemperature() {
    const raw = this.configService.get<string>('AI_TEMPERATURE');
    const parsed = raw ? Number(raw) : 0.3;
    return Number.isFinite(parsed) ? parsed : 0.3;
  }

  private getTranscriptionModel() {
    return this.configService.get<string>('AI_TRANSCRIPTION_MODEL') || 'whisper-1';
  }
}
