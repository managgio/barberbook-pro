import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ChatWithAiAssistantUseCase } from '@/contexts/ai-orchestration/application/use-cases/chat-with-ai-assistant.use-case';
import { GetAiAssistantSessionUseCase } from '@/contexts/ai-orchestration/application/use-cases/get-ai-assistant-session.use-case';
import { TranscribeAiAudioUseCase } from '@/contexts/ai-orchestration/application/use-cases/transcribe-ai-audio.use-case';
import {
  AiAssistantNotFoundError,
  AiAssistantValidationError,
} from '@/contexts/ai-orchestration/application/errors/ai-assistant.errors';

test('chat use case enforces daily message limit', async () => {
  const useCase = new ChatWithAiAssistantUseCase(
    {
      findUserById: async () => ({ id: 'admin-1', isSuperAdmin: true, isPlatformAdmin: false }),
      hasLocationStaffMembership: async () => true,
    } as any,
    {
      getDailyUserMessageCount: async () => 20,
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  await assert.rejects(
    () => useCase.execute({
      adminUserId: 'admin-1',
      message: 'hola',
      localId: 'loc-1',
      timeZone: 'Europe/Madrid',
    }),
    (error: unknown) =>
      error instanceof AiAssistantValidationError
      && error.message.includes('Límite diario alcanzado'),
  );
});

test('chat use case always forwards rawText from current user message to create_appointment tool', async () => {
  let capturedArgs: Record<string, unknown> | null = null;
  const userMessage = 'Crea una cita para María López para el lunes que viene por la tarde para un corte clásico';
  const llmToolArgs = {
    userName: 'María López',
    serviceName: 'corte clásico',
    date: '2026-03-09',
    time: '09:00',
    rawText: 'Crea una cita para María López el 9 de marzo de 2026 a las 09:00',
  };

  const useCase = new ChatWithAiAssistantUseCase(
    {
      findUserById: async () => ({ id: 'admin-1', isSuperAdmin: true, isPlatformAdmin: false }),
      hasLocationStaffMembership: async () => true,
    } as any,
    {
      getDailyUserMessageCount: async () => 0,
      getOrCreateSession: async () => ({ id: 'session-1' }),
      appendMessage: async () => undefined,
      getSummary: async () => '',
      getFacts: async () => [],
      getRecentMessages: async () => [],
      shouldUpdateSummary: async () => false,
    } as any,
    {
      getTools: () => [
        {
          type: 'function',
          function: {
            name: 'create_appointment',
            description: 'Creates appointment',
            parameters: { type: 'object', properties: {}, additionalProperties: true },
          },
        },
      ],
      execute: async (_toolName: string, args: Record<string, unknown>) => {
        capturedArgs = { ...args };
        return { status: 'needs_info', missing: ['date'] };
      },
    } as any,
    {
      getChatConfig: async () => ({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 500,
      }),
      isAlertsEnabled: async () => true,
    } as any,
    {
      completeChat: async () => ({
        message: {
          content: '',
          toolCalls: [
            {
              id: 'tool-call-1',
              type: 'function',
              function: {
                name: 'create_appointment',
                arguments: JSON.stringify(llmToolArgs),
              },
            },
          ],
        },
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      }),
    } as any,
    {
      recordOpenAiUsage: async () => undefined,
    } as any,
  );

  await useCase.execute({
    adminUserId: 'admin-1',
    message: userMessage,
    localId: 'local-1',
    timeZone: 'Europe/Madrid',
  });

  assert.ok(capturedArgs);
  assert.equal((capturedArgs as Record<string, unknown>).rawText, userMessage);
});

test('session use case reads latest active session when sessionId is omitted', async () => {
  const useCase = new GetAiAssistantSessionUseCase(
    {
      findUserById: async () => ({ id: 'admin-1', isSuperAdmin: true, isPlatformAdmin: false }),
      hasLocationStaffMembership: async () => true,
    } as any,
    {
      getLatestSessionMessages: async () => ({
        session: { id: 'session-latest', summary: 'Resumen' },
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'Hola',
            createdAt: new Date('2026-03-07T10:00:00.000Z'),
          },
        ],
      }),
    } as any,
  );

  const result = await useCase.execute({
    adminUserId: 'admin-1',
    localId: 'local-1',
  });

  assert.equal(result.sessionId, 'session-latest');
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0]?.id, 'message-1');
});

test('session use case throws not found when latest session is unavailable', async () => {
  const useCase = new GetAiAssistantSessionUseCase(
    {
      findUserById: async () => ({ id: 'admin-1', isSuperAdmin: true, isPlatformAdmin: false }),
      hasLocationStaffMembership: async () => true,
    } as any,
    {
      getLatestSessionMessages: async () => null,
    } as any,
  );

  await assert.rejects(
    () => useCase.execute({ adminUserId: 'admin-1', localId: 'local-1' }),
    (error: unknown) => error instanceof AiAssistantNotFoundError,
  );
});

test('transcribe use case validates max audio size', async () => {
  const useCase = new TranscribeAiAudioUseCase(
    {
      findUserById: async () => ({ id: 'admin-1', isSuperAdmin: true, isPlatformAdmin: false }),
      hasLocationStaffMembership: async () => true,
    } as any,
    {} as any,
    {} as any,
  );

  await assert.rejects(
    () =>
      useCase.execute({
        adminUserId: 'admin-1',
        localId: 'loc-1',
        file: {
          buffer: Buffer.from('x'),
          size: 11 * 1024 * 1024,
          mimetype: 'audio/webm',
          originalname: 'voice.webm',
        },
      }),
    (error: unknown) =>
      error instanceof AiAssistantValidationError
      && error.message.includes('10MB'),
  );
});
