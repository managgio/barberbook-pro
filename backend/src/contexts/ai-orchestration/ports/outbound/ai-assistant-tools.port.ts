import {
  AiCreateAlertResult,
  AiCreateAppointmentResult,
  AiHolidayActionResult,
  AiToolContext,
  AiToolName,
} from '../../domain/types/assistant.types';

export const AI_ASSISTANT_TOOLS_PORT = Symbol('AI_ASSISTANT_TOOLS_PORT');

export type AiAssistantToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type AiAssistantToolResult =
  | AiCreateAlertResult
  | AiCreateAppointmentResult
  | AiHolidayActionResult;

export interface AiAssistantToolsPort {
  getTools(): AiAssistantToolDefinition[];
  execute(toolName: AiToolName, args: Record<string, unknown>, context: AiToolContext): Promise<AiAssistantToolResult>;
}
