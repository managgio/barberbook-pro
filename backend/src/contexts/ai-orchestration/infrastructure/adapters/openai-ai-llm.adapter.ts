import { Injectable } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import {
  AiLlmCompletion,
  AiLlmMessageParam,
  AiLlmPort,
  AiLlmToolCall,
} from '../../ports/outbound/ai-llm.port';

@Injectable()
export class OpenAiLlmAdapter implements AiLlmPort {
  private readonly clientCache = new Map<string, OpenAI>();

  async completeChat(input: {
    apiKey: string;
    model: string;
    messages: AiLlmMessageParam[];
    tools: Array<{
      type: 'function';
      function: {
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
      };
    }>;
    toolChoice: 'auto' | 'required' | { type: 'function'; function: { name: string } };
    temperature: number;
    maxTokens: number;
  }): Promise<AiLlmCompletion> {
    const completion = await (await this.getClient(input.apiKey)).chat.completions.create({
      model: input.model,
      messages: input.messages as any,
      tools: input.tools.length > 0 ? (input.tools as any) : undefined,
      tool_choice: input.tools.length > 0 ? (input.toolChoice as any) : undefined,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
    });

    const responseMessage = completion.choices[0]?.message;
    return {
      message: {
        content: responseMessage?.content?.trim() || '',
        toolCalls: (responseMessage?.tool_calls || []) as AiLlmToolCall[],
      },
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    };
  }

  async transcribeAudio(input: {
    apiKey: string;
    model: string;
    language: string;
    temperature: number;
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<{ text: string }> {
    const audioFile = await toFile(input.buffer, input.fileName, {
      type: input.mimeType,
    });

    const response = await (await this.getClient(input.apiKey)).audio.transcriptions.create({
      file: audioFile,
      model: input.model,
      language: input.language,
      temperature: input.temperature,
    });

    return { text: response.text?.trim() || '' };
  }

  private async getClient(apiKey: string) {
    if (this.clientCache.has(apiKey)) {
      return this.clientCache.get(apiKey) as OpenAI;
    }
    const client = new OpenAI({ apiKey });
    this.clientCache.set(apiKey, client);
    return client;
  }
}
