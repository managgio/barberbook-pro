import {
  PlatformAiConversationFilters,
  PlatformAiConversationReadPort,
} from '../../ports/outbound/platform-ai-conversation-read.port';

export class ReadPlatformAiConversationsUseCase {
  constructor(private readonly conversationReadPort: PlatformAiConversationReadPort) {}

  list(filters: PlatformAiConversationFilters) {
    return this.conversationReadPort.list(filters);
  }

  getById(sessionId: string) {
    return this.conversationReadPort.getById(sessionId);
  }
}
