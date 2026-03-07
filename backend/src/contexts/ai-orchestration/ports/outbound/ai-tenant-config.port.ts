export const AI_TENANT_CONFIG_PORT = Symbol('AI_TENANT_CONFIG_PORT');

export type AiChatConfig = {
  provider: string;
  apiKey: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
};

export type AiTranscriptionConfig = {
  provider: string;
  apiKey: string | null;
  model: string;
  language: string;
  temperature: number;
};

export interface AiTenantConfigPort {
  isAlertsEnabled(): Promise<boolean>;
  getChatConfig(): Promise<AiChatConfig>;
  getTranscriptionConfig(): Promise<AiTranscriptionConfig>;
}
