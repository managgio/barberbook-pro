import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ChatWithAiAssistantUseCase,
} from '@/contexts/ai-orchestration/application/use-cases/chat-with-ai-assistant.use-case';
import {
  GetAiAssistantSessionUseCase,
} from '@/contexts/ai-orchestration/application/use-cases/get-ai-assistant-session.use-case';
import {
  TranscribeAiAudioUseCase,
} from '@/contexts/ai-orchestration/application/use-cases/transcribe-ai-audio.use-case';
import {
  createChatWithAiAssistantUseCaseFromDeps,
  createGetAiAssistantSessionUseCaseFromDeps,
  createTranscribeAiAudioUseCaseFromDeps,
} from '@/modules/ai-assistant/ai-assistant.use-case-factories';

test('ai assistant chat use case factory maps positional deps into object deps', () => {
  const dep1: any = { n: 1 };
  const dep2: any = { n: 2 };
  const dep3: any = { n: 3 };
  const dep4: any = { n: 4 };
  const dep5: any = { n: 5 };
  const dep6: any = { n: 6 };
  const useCase = createChatWithAiAssistantUseCaseFromDeps(dep1, dep2, dep3, dep4, dep5, dep6);

  assert.ok(useCase instanceof ChatWithAiAssistantUseCase);
  assert.equal((useCase as any).adminAccessReadPort, dep1);
  assert.equal((useCase as any).memoryPort, dep2);
  assert.equal((useCase as any).toolsPort, dep3);
  assert.equal((useCase as any).tenantConfigPort, dep4);
  assert.equal((useCase as any).llmPort, dep5);
  assert.equal((useCase as any).usageMetricsPort, dep6);
});

test('ai assistant session use case factory maps positional deps into object deps', () => {
  const dep1: any = { n: 1 };
  const dep2: any = { n: 2 };
  const useCase = createGetAiAssistantSessionUseCaseFromDeps(dep1, dep2);

  assert.ok(useCase instanceof GetAiAssistantSessionUseCase);
  assert.equal((useCase as any).adminAccessReadPort, dep1);
  assert.equal((useCase as any).memoryPort, dep2);
});

test('ai assistant transcribe use case factory maps positional deps into object deps', () => {
  const dep1: any = { n: 1 };
  const dep2: any = { n: 2 };
  const dep3: any = { n: 3 };
  const useCase = createTranscribeAiAudioUseCaseFromDeps(dep1, dep2, dep3);

  assert.ok(useCase instanceof TranscribeAiAudioUseCase);
  assert.equal((useCase as any).adminAccessReadPort, dep1);
  assert.equal((useCase as any).tenantConfigPort, dep2);
  assert.equal((useCase as any).llmPort, dep3);
});
