import { AiAssistantToolDefinition } from './ai-assistant-tools.port';

export const AI_LLM_PORT = Symbol('AI_LLM_PORT');

export type AiLlmToolCall = {
  id: string;
  function: {
    name: string;
    arguments?: string;
  };
};

export type AiLlmMessageParam = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: AiLlmToolCall[];
};

export type AiLlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AiLlmCompletion = {
  message: {
    content: string;
    toolCalls: AiLlmToolCall[];
  };
  usage: AiLlmUsage;
};

export interface AiLlmPort {
  completeChat(input: {
    apiKey: string;
    model: string;
    messages: AiLlmMessageParam[];
    tools: AiAssistantToolDefinition[];
    toolChoice: 'auto' | 'required' | { type: 'function'; function: { name: string } };
    temperature: number;
    maxTokens: number;
  }): Promise<AiLlmCompletion>;
  transcribeAudio(input: {
    apiKey: string;
    model: string;
    language: string;
    temperature: number;
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<{ text: string }>;
}
