import { createChatWithAiAssistantUseCase } from '../../contexts/ai-orchestration/application/use-cases/chat-with-ai-assistant.use-case';
import { createGetAiAssistantSessionUseCase } from '../../contexts/ai-orchestration/application/use-cases/get-ai-assistant-session.use-case';
import { createTranscribeAiAudioUseCase } from '../../contexts/ai-orchestration/application/use-cases/transcribe-ai-audio.use-case';

type ChatDeps = Parameters<typeof createChatWithAiAssistantUseCase>[0];
type SessionDeps = Parameters<typeof createGetAiAssistantSessionUseCase>[0];
type TranscribeDeps = Parameters<typeof createTranscribeAiAudioUseCase>[0];

export const createChatWithAiAssistantUseCaseFromDeps = (
  adminAccessReadPort: ChatDeps['adminAccessReadPort'],
  memoryPort: ChatDeps['memoryPort'],
  toolsPort: ChatDeps['toolsPort'],
  tenantConfigPort: ChatDeps['tenantConfigPort'],
  llmPort: ChatDeps['llmPort'],
  usageMetricsPort: ChatDeps['usageMetricsPort'],
) =>
  createChatWithAiAssistantUseCase({
    adminAccessReadPort,
    memoryPort,
    toolsPort,
    tenantConfigPort,
    llmPort,
    usageMetricsPort,
  });

export const createGetAiAssistantSessionUseCaseFromDeps = (
  adminAccessReadPort: SessionDeps['adminAccessReadPort'],
  memoryPort: SessionDeps['memoryPort'],
) =>
  createGetAiAssistantSessionUseCase({
    adminAccessReadPort,
    memoryPort,
  });

export const createTranscribeAiAudioUseCaseFromDeps = (
  adminAccessReadPort: TranscribeDeps['adminAccessReadPort'],
  tenantConfigPort: TranscribeDeps['tenantConfigPort'],
  llmPort: TranscribeDeps['llmPort'],
) =>
  createTranscribeAiAudioUseCase({
    adminAccessReadPort,
    tenantConfigPort,
    llmPort,
  });
