import { Injectable } from '@nestjs/common';
import {
  AiAssistantToolDefinition,
  AiAssistantToolsPort,
} from '../../../contexts/ai-orchestration/ports/outbound/ai-assistant-tools.port';
import { AiToolContext, AiToolName } from '../../../contexts/ai-orchestration/domain/types/assistant.types';
import { AiToolsRegistry } from '../ai-tools.registry';

@Injectable()
export class ModuleAiAssistantToolsAdapter implements AiAssistantToolsPort {
  constructor(private readonly aiToolsRegistry: AiToolsRegistry) {}

  getTools(): AiAssistantToolDefinition[] {
    return this.aiToolsRegistry.getTools() as AiAssistantToolDefinition[];
  }

  execute(toolName: AiToolName, args: Record<string, unknown>, context: AiToolContext) {
    return this.aiToolsRegistry.execute(toolName, args, context);
  }
}
