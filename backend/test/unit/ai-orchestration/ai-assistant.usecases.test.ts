import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ChatWithAiAssistantUseCase } from '@/contexts/ai-orchestration/application/use-cases/chat-with-ai-assistant.use-case';
import { TranscribeAiAudioUseCase } from '@/contexts/ai-orchestration/application/use-cases/transcribe-ai-audio.use-case';
import { AiAssistantValidationError } from '@/contexts/ai-orchestration/application/errors/ai-assistant.errors';

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
