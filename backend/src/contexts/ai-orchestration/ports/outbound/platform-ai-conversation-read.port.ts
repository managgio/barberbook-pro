export const PLATFORM_AI_CONVERSATION_READ_PORT = Symbol('PLATFORM_AI_CONVERSATION_READ_PORT');

export type PlatformAiInputSource = 'typed' | 'voice' | 'template';

export type PlatformAiConversationFilters = {
  page: number;
  pageSize: number;
  days: number;
  brandId?: string;
  localId?: string;
  source?: PlatformAiInputSource;
  search?: string;
};

export interface PlatformAiConversationReadPort {
  list(filters: PlatformAiConversationFilters): Promise<unknown>;
  getById(sessionId: string): Promise<unknown | null>;
}
