import {
  detectForcedToolFromAssistantPrompt,
  isLikelyAiToolActionMessage,
  isSingleHolidayRangeIntent,
} from '../../domain/services/assistant-intent-policy';
import {
  buildAlertResponseMessage,
  buildCreateAppointmentFallbackMessage,
  buildHolidayResponseMessage,
  sanitizeAssistantMessage,
} from '../../domain/services/assistant-response-policy';
import { AiCreateAlertResult, AiCreateAppointmentResult, AiHolidayActionResult, AiToolName } from '../../domain/types/assistant.types';
import { AI_ADMIN_ACCESS_READ_PORT, AiAdminAccessReadPort } from '../../ports/outbound/ai-admin-access-read.port';
import { AI_ASSISTANT_MEMORY_PORT, AiAssistantMemoryPort } from '../../ports/outbound/ai-assistant-memory.port';
import {
  AI_ASSISTANT_TOOLS_PORT,
  AiAssistantToolDefinition,
  AiAssistantToolsPort,
} from '../../ports/outbound/ai-assistant-tools.port';
import { AI_LLM_PORT, AiLlmMessageParam, AiLlmPort, AiLlmToolCall } from '../../ports/outbound/ai-llm.port';
import { AI_TENANT_CONFIG_PORT, AiTenantConfigPort } from '../../ports/outbound/ai-tenant-config.port';
import { AI_USAGE_METRICS_PORT, AiUsageMetricsPort } from '../../ports/outbound/ai-usage-metrics.port';
import {
  AiAssistantUnavailableError,
  AiAssistantValidationError,
} from '../errors/ai-assistant.errors';
import { AI_SYSTEM_PROMPT, buildSummaryPrompt } from '../prompts/assistant.prompts';

const MAX_HISTORY_MESSAGES = 16;
const SUMMARY_EVERY_MESSAGES = 8;
const SUMMARY_MAX_MESSAGES = 10;
const DAILY_MESSAGE_LIMIT = 20;

export interface ChatWithAiAssistantInput {
  adminUserId: string;
  message: string;
  sessionId?: string | null;
  localId: string;
  timeZone: string;
}

export interface ChatWithAiAssistantResult {
  sessionId: string;
  assistantMessage: string;
  actions?: {
    appointmentsChanged?: boolean;
    holidaysChanged?: boolean;
    alertsChanged?: boolean;
  };
}

export class ChatWithAiAssistantUseCase {
  constructor(
    private readonly adminAccessReadPort: AiAdminAccessReadPort,
    private readonly memoryPort: AiAssistantMemoryPort,
    private readonly toolsPort: AiAssistantToolsPort,
    private readonly tenantConfigPort: AiTenantConfigPort,
    private readonly llmPort: AiLlmPort,
    private readonly usageMetricsPort: AiUsageMetricsPort,
  ) {}

  async execute(input: ChatWithAiAssistantInput): Promise<ChatWithAiAssistantResult> {
    await this.ensureAdminUser(input.adminUserId, input.localId);
    const dailyCount = await this.memoryPort.getDailyUserMessageCount(input.adminUserId, input.timeZone);
    if (dailyCount >= DAILY_MESSAGE_LIMIT) {
      throw new AiAssistantValidationError(
        `Límite diario alcanzado (${DAILY_MESSAGE_LIMIT} mensajes). Inténtalo de nuevo mañana.`,
      );
    }

    const session = await this.memoryPort.getOrCreateSession(input.adminUserId, input.sessionId);
    await this.memoryPort.appendMessage({
      sessionId: session.id,
      role: 'user',
      content: input.message.trim(),
    });

    const summary = await this.memoryPort.getSummary(session.id);
    const facts = await this.memoryPort.getFacts(10);
    const recentMessages = await this.memoryPort.getRecentMessages(session.id, MAX_HISTORY_MESSAGES);
    const chatConfig = await this.tenantConfigPort.getChatConfig();
    this.ensureOpenAiProvider(chatConfig.provider, chatConfig.apiKey);

    const now = new Date();
    const alertsEnabled = await this.tenantConfigPort.isAlertsEnabled();
    const nowDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: input.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const nowTime = new Intl.DateTimeFormat('es-ES', {
      timeZone: input.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const messages: AiLlmMessageParam[] = [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'system', content: `Fecha actual: ${nowDate}. Hora actual: ${nowTime}. Zona horaria: ${input.timeZone}.` },
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

    let toolDefs: AiAssistantToolDefinition[] = this.toolsPort.getTools();
    if (!alertsEnabled) {
      toolDefs = toolDefs.filter((tool) => tool.function.name !== 'create_alert');
    }
    let assistantMessage = '';
    let appointmentsChanged = false;
    let holidaysChanged = false;
    let alertsChanged = false;
    const enforceSingleHolidayRangeCall = isSingleHolidayRangeIntent(input.message);
    const lastAssistantMessage = [...recentMessages].reverse().find((msg) => msg.role === 'assistant')?.content ?? '';
    let forcedTool = detectForcedToolFromAssistantPrompt(lastAssistantMessage);
    if (!alertsEnabled && forcedTool === 'create_alert') {
      forcedTool = null;
    }
    const requireToolForActionRequest = isLikelyAiToolActionMessage(input.message);

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const completion = await this.llmPort.completeChat({
          apiKey: chatConfig.apiKey as string,
          model: chatConfig.model,
          messages,
          tools: toolDefs,
          toolChoice: forcedTool
            ? { type: 'function', function: { name: forcedTool } }
            : requireToolForActionRequest
              ? 'required'
              : 'auto',
          temperature: chatConfig.temperature,
          maxTokens: chatConfig.maxTokens,
        });

        await this.trackOpenAiUsage(completion.usage, chatConfig.model);
        const responseMessage = completion.message;

        if (responseMessage.toolCalls.length) {
          messages.push({
            role: 'assistant',
            content: responseMessage.content || '',
            tool_calls: responseMessage.toolCalls,
          });

          const holidaySuccessMessages: string[] = [];
          const holidayNeedsInfoMessages: string[] = [];
          const holidayErrorMessages: string[] = [];
          let holidayToolExecuted = false;
          let appointmentMessage: string | null = null;
          let alertMessage: string | null = null;

          for (const toolCall of responseMessage.toolCalls) {
            const toolName = toolCall.function.name as AiToolName;
            if (!toolDefs.some((tool) => tool.function.name === toolName)) {
              throw new AiAssistantValidationError(`Tool no permitida: ${toolName}`);
            }

            const isHolidayTool = toolName === 'add_barber_holiday' || toolName === 'add_shop_holiday';
            if (isHolidayTool && enforceSingleHolidayRangeCall && holidayToolExecuted) {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ status: 'skipped', reason: 'single_holiday_range_guard' }),
              });
              continue;
            }

            const args = this.parseToolArguments(toolCall);
            if (
              toolName === 'create_appointment'
              || toolName === 'add_barber_holiday'
              || toolName === 'add_shop_holiday'
              || toolName === 'create_alert'
            ) {
              const rawText = typeof args.rawText === 'string' ? args.rawText.trim() : '';
              if (!rawText) {
                args.rawText = input.message;
              }
            }

            const toolResult = await this.toolsPort.execute(toolName, args, {
              adminUserId: input.adminUserId,
              timeZone: input.timeZone,
              now,
            });

            if (toolName === 'create_appointment') {
              const appointmentResult = toolResult as AiCreateAppointmentResult;
              appointmentMessage = buildCreateAppointmentFallbackMessage(appointmentResult, input.timeZone);
              if (appointmentResult.status === 'created') {
                appointmentsChanged = true;
              }
            }

            if (toolName === 'create_alert') {
              const alertResult = toolResult as AiCreateAlertResult;
              alertMessage = buildAlertResponseMessage(alertResult);
              if (alertResult.status === 'created') {
                alertsChanged = true;
              }
            }

            if (toolName === 'add_barber_holiday' || toolName === 'add_shop_holiday') {
              holidayToolExecuted = true;
              const holidayResult = toolResult as AiHolidayActionResult;
              if (holidayResult.status === 'added') {
                holidaysChanged = true;
              }
              const holidayMessage = buildHolidayResponseMessage(holidayResult);
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
      if (error instanceof AiAssistantValidationError) throw error;
      throw new AiAssistantUnavailableError('No se pudo completar la solicitud de IA.');
    }

    if (!assistantMessage) {
      assistantMessage = 'No pude generar una respuesta útil ahora mismo.';
    }

    assistantMessage = sanitizeAssistantMessage(assistantMessage);

    await this.memoryPort.appendMessage({
      sessionId: session.id,
      role: 'assistant',
      content: assistantMessage,
    });

    if (await this.memoryPort.shouldUpdateSummary(session.id, SUMMARY_EVERY_MESSAGES)) {
      await this.updateSummary(session.id, summary, chatConfig.apiKey as string, chatConfig.model);
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

  private ensureOpenAiProvider(provider: string, apiKey: string | null) {
    if (provider !== 'openai') {
      throw new AiAssistantValidationError('Proveedor IA no soportado.');
    }
    if (!apiKey) {
      throw new AiAssistantValidationError('Falta AI_API_KEY en el entorno.');
    }
  }

  private parseToolArguments(toolCall: AiLlmToolCall): Record<string, unknown> {
    try {
      return toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
    } catch {
      throw new AiAssistantValidationError(`Argumentos inválidos para ${toolCall.function.name}`);
    }
  }

  private async updateSummary(sessionId: string, previousSummary: string, apiKey: string, model: string) {
    const recentMessages = await this.memoryPort.getRecentMessages(sessionId, SUMMARY_MAX_MESSAGES);
    if (recentMessages.length === 0) return;

    const transcript = recentMessages.map((msg) => `${msg.role}: ${msg.content}`);
    const prompt = buildSummaryPrompt(previousSummary, transcript);

    try {
      const completion = await this.llmPort.completeChat({
        apiKey,
        model,
        messages: [
          { role: 'system', content: 'Eres un asistente que resume conversaciones de negocio.' },
          { role: 'user', content: prompt },
        ],
        tools: [],
        toolChoice: 'auto',
        temperature: 0.2,
        maxTokens: 200,
      });
      await this.trackOpenAiUsage(completion.usage, model);
      const summary = completion.message.content?.trim();
      if (summary) {
        await this.memoryPort.updateSummary(sessionId, summary);
      }
    } catch {
      // Keep chat flow robust even if summary update fails.
    }
  }

  private async trackOpenAiUsage(
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number },
    model?: string,
  ) {
    if (!usage || !model) return;
    try {
      await this.usageMetricsPort.recordOpenAiUsage({
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      });
    } catch {
      // Non-critical observability path.
    }
  }

  private async ensureAdminUser(adminUserId: string, localId: string) {
    const user = await this.adminAccessReadPort.findUserById({ userId: adminUserId });
    if (!user) {
      throw new AiAssistantValidationError('Usuario admin inválido.');
    }
    if (user.isSuperAdmin || user.isPlatformAdmin) {
      return;
    }
    const hasStaffMembership = await this.adminAccessReadPort.hasLocationStaffMembership({
      localId,
      userId: adminUserId,
    });
    if (!hasStaffMembership) {
      throw new AiAssistantValidationError('Usuario admin inválido.');
    }
  }
}

export const CHAT_WITH_AI_ASSISTANT_USE_CASE = Symbol('CHAT_WITH_AI_ASSISTANT_USE_CASE');

export const createChatWithAiAssistantUseCase = (deps: {
  adminAccessReadPort: AiAdminAccessReadPort;
  memoryPort: AiAssistantMemoryPort;
  toolsPort: AiAssistantToolsPort;
  tenantConfigPort: AiTenantConfigPort;
  llmPort: AiLlmPort;
  usageMetricsPort: AiUsageMetricsPort;
}) =>
  new ChatWithAiAssistantUseCase(
    deps.adminAccessReadPort,
    deps.memoryPort,
    deps.toolsPort,
    deps.tenantConfigPort,
    deps.llmPort,
    deps.usageMetricsPort,
  );

export const CHAT_WITH_AI_ASSISTANT_USE_CASE_DEPS = {
  adminAccessReadPort: AI_ADMIN_ACCESS_READ_PORT,
  memoryPort: AI_ASSISTANT_MEMORY_PORT,
  toolsPort: AI_ASSISTANT_TOOLS_PORT,
  tenantConfigPort: AI_TENANT_CONFIG_PORT,
  llmPort: AI_LLM_PORT,
  usageMetricsPort: AI_USAGE_METRICS_PORT,
} as const;
