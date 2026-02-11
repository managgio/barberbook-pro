import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentBrandId, getCurrentLocalId } from '../../tenancy/tenant.context';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { AiMemoryService } from './ai-memory.service';
import { AiToolsRegistry } from './ai-tools.registry';
import { AI_SYSTEM_PROMPT, buildSummaryPrompt } from './ai-assistant.prompt';
import { AiCreateAlertResult, AiCreateAppointmentResult, AiHolidayActionResult, AiToolName } from './ai-assistant.types';
import { AI_TIME_ZONE, formatTimeInTimeZone, getDateStringInTimeZone } from './ai-assistant.utils';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';

const MAX_HISTORY_MESSAGES = 16;
const SUMMARY_EVERY_MESSAGES = 8;
const SUMMARY_MAX_MESSAGES = 10;
const DAILY_MESSAGE_LIMIT = 20;

export interface AiChatResult {
  sessionId: string;
  assistantMessage: string;
  actions?: {
    appointmentsChanged?: boolean;
    holidaysChanged?: boolean;
    alertsChanged?: boolean;
  };
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly clientCache = new Map<string, OpenAI>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: AiMemoryService,
    private readonly toolsRegistry: AiToolsRegistry,
    private readonly tenantConfig: TenantConfigService,
    private readonly usageMetrics: UsageMetricsService,
  ) {}

  async chat(adminUserId: string, message: string, sessionId?: string | null): Promise<AiChatResult> {
    await this.ensureAdminUser(adminUserId);
    const dailyCount = await this.memory.getDailyUserMessageCount(AI_TIME_ZONE);
    if (dailyCount >= DAILY_MESSAGE_LIMIT) {
      throw new BadRequestException(
        `Límite diario alcanzado (${DAILY_MESSAGE_LIMIT} mensajes). Inténtalo de nuevo mañana.`,
      );
    }

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
    const alertsEnabled = await this.isAlertsEnabledForTenant();
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

    let toolDefs = this.getToolDefinitions();
    if (!alertsEnabled) {
      toolDefs = toolDefs.filter((tool) => tool.function.name !== 'create_alert');
    }
    let assistantMessage = '';
    let appointmentsChanged = false;
    let holidaysChanged = false;
    let alertsChanged = false;
    const lastAssistantMessage = [...recentMessages].reverse().find((msg) => msg.role === 'assistant')?.content ?? '';
    let forcedTool = this.detectForcedTool(lastAssistantMessage);
    if (!alertsEnabled && forcedTool === 'create_alert') {
      forcedTool = null;
    }
    const requireToolForActionRequest = this.isLikelyToolActionMessage(message);

    const model = await this.getModel();
    const temperature = await this.getTemperature();
    const maxTokens = await this.getMaxTokens();

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const completion = await (await this.getClient()).chat.completions.create({
          model,
          messages,
          tools: toolDefs,
          tool_choice: forcedTool
            ? { type: 'function', function: { name: forcedTool } }
            : requireToolForActionRequest
              ? 'required'
              : 'auto',
          temperature,
          max_tokens: maxTokens,
        });

        void this.trackOpenAiUsage(completion.usage, model);
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
          let alertMessage: string | null = null;

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
              || toolName === 'create_alert'
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

            if (toolName === 'create_alert') {
              alertMessage = this.buildAlertResponse(toolResult as AiCreateAlertResult);
              if ((toolResult as AiCreateAlertResult).status === 'created') {
                alertsChanged = true;
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
          }

          const responseParts = [
            ...(appointmentMessage ? [appointmentMessage] : []),
            ...(alertMessage ? [alertMessage] : []),
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
        appointmentsChanged || holidaysChanged || alertsChanged
          ? {
              ...(appointmentsChanged ? { appointmentsChanged } : {}),
              ...(holidaysChanged ? { holidaysChanged } : {}),
              ...(alertsChanged ? { alertsChanged } : {}),
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

    const response = await (await this.getClient()).audio.transcriptions.create({
      file: audioFile,
      model: await this.getTranscriptionModel(),
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

  private buildAlertResponse(result: AiCreateAlertResult): string | null {
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
  }

  private async isAlertsEnabledForTenant() {
    const config = await this.tenantConfig.getPublicConfig();
    const hidden = config?.adminSidebar?.hiddenSections || [];
    return !hidden.includes('alerts');
  }

  private normalizeIntentText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private getToolDefinitions() {
    return this.toolsRegistry.getTools();
  }

  private detectForcedTool(lastAssistantMessage?: string): AiToolName | null {
    if (!lastAssistantMessage) return null;
    const lastNormalized = this.normalizeIntentText(lastAssistantMessage);
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
  }

  private isLikelyToolActionMessage(message: string) {
    const normalized = this.normalizeIntentText(message || '');
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
  }

  private async updateSummary(sessionId: string, previousSummary: string) {
    const recentMessages = await this.memory.getRecentMessages(sessionId, SUMMARY_MAX_MESSAGES);
    if (recentMessages.length === 0) return;

    const transcript = recentMessages.map((msg) => `${msg.role}: ${msg.content}`);
    const prompt = buildSummaryPrompt(previousSummary, transcript);

    const model = await this.getModel();
    try {
      const completion = await (await this.getClient()).chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'Eres un asistente que resume conversaciones de negocio.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
      });
      void this.trackOpenAiUsage(completion.usage, model);
      const summary = completion.choices[0]?.message?.content?.trim();
      if (summary) {
        await this.memory.updateSummary(sessionId, summary);
      }
    } catch (error) {
      this.logger.warn('No se pudo actualizar el resumen de la sesión.');
    }
  }

  private async trackOpenAiUsage(
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
    model?: string,
  ) {
    if (!usage || !model) return;
    try {
      await this.usageMetrics.recordOpenAiUsage({
        model,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      });
    } catch (error) {
      this.logger.warn('No se pudo registrar el uso de OpenAI.');
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
    if (!user) {
      throw new BadRequestException('Usuario admin inválido.');
    }
    if (user.isSuperAdmin || user.isPlatformAdmin) {
      return;
    }
    const localId = getCurrentLocalId();
    const staff = await this.prisma.locationStaff.findUnique({
      where: {
        localId_userId: {
          localId,
          userId: adminUserId,
        },
      },
    });
    if (!staff) {
      throw new BadRequestException('Usuario admin inválido.');
    }
  }

  private async getClient() {
    const brandId = getCurrentBrandId();
    if (this.clientCache.has(brandId)) {
      return this.clientCache.get(brandId) as OpenAI;
    }
    const config = await this.tenantConfig.getBrandConfig(brandId);
    const provider = config.ai?.provider || 'openai';
    if (provider !== 'openai') {
      throw new BadRequestException('Proveedor IA no soportado.');
    }
    const apiKey = config.ai?.apiKey;
    if (!apiKey) {
      throw new BadRequestException('Falta AI_API_KEY en el entorno.');
    }
    const client = new OpenAI({ apiKey });
    this.clientCache.set(brandId, client);
    return client;
  }

  private async getModel() {
    const config = await this.tenantConfig.getBrandConfig(getCurrentBrandId());
    return config.ai?.model || 'gpt-4o-mini';
  }

  private async getMaxTokens() {
    const config = await this.tenantConfig.getBrandConfig(getCurrentBrandId());
    const raw = config.ai?.maxTokens ?? 800;
    const parsed = typeof raw === 'string' ? Number(raw) : raw;
    return Number.isFinite(parsed) ? parsed : 800;
  }

  private async getTemperature() {
    const config = await this.tenantConfig.getBrandConfig(getCurrentBrandId());
    const raw = config.ai?.temperature ?? 0.3;
    const parsed = typeof raw === 'string' ? Number(raw) : raw;
    return Number.isFinite(parsed) ? parsed : 0.3;
  }

  private async getTranscriptionModel() {
    const config = await this.tenantConfig.getBrandConfig(getCurrentBrandId());
    return config.ai?.transcriptionModel || 'whisper-1';
  }
}
