import { Inject, Injectable } from '@nestjs/common';
import { ReadPlatformAiConversationsUseCase } from '../../contexts/ai-orchestration/application/use-cases/read-platform-ai-conversations.use-case';
import {
  PLATFORM_AI_CONVERSATION_READ_PORT,
  PlatformAiConversationFilters,
  PlatformAiConversationReadPort,
} from '../../contexts/ai-orchestration/ports/outbound/platform-ai-conversation-read.port';

@Injectable()
export class PlatformAiConversationsService {
  private readonly readUseCase: ReadPlatformAiConversationsUseCase;

  constructor(
    @Inject(PLATFORM_AI_CONVERSATION_READ_PORT)
    conversationReadPort: PlatformAiConversationReadPort,
  ) {
    this.readUseCase = new ReadPlatformAiConversationsUseCase(conversationReadPort);
  }

  list(filters: PlatformAiConversationFilters) {
    return this.readUseCase.list(filters);
  }

  getById(sessionId: string) {
    return this.readUseCase.getById(sessionId);
  }
}
