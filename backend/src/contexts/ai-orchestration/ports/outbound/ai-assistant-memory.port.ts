export const AI_ASSISTANT_MEMORY_PORT = Symbol('AI_ASSISTANT_MEMORY_PORT');

export type AiAssistantStoredMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
};

export type AiAssistantSessionRecord = {
  id: string;
  summary: string;
};

export interface AiAssistantMemoryPort {
  getDailyUserMessageCount(adminUserId: string, timeZone: string): Promise<number>;
  getOrCreateSession(adminUserId: string, sessionId?: string | null): Promise<{ id: string }>;
  appendMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string | null;
    toolPayload?: unknown | null;
  }): Promise<unknown>;
  getSummary(sessionId: string): Promise<string>;
  getFacts(limit: number): Promise<Array<{ key: string; value: string }>>;
  getRecentMessages(sessionId: string, limit: number): Promise<Array<{ role: string; content: string }>>;
  shouldUpdateSummary(sessionId: string, every: number): Promise<boolean>;
  updateSummary(sessionId: string, summary: string): Promise<void>;
  getSessionMessages(
    sessionId: string,
    adminUserId: string,
    limit: number,
  ): Promise<{ session: AiAssistantSessionRecord; messages: AiAssistantStoredMessage[] } | null>;
}
