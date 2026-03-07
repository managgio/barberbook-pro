export const AI_ASSISTANT_MEMORY_MAINTENANCE_PORT = Symbol('AI_ASSISTANT_MEMORY_MAINTENANCE_PORT');

export interface AiAssistantMemoryMaintenancePort {
  cleanupForLocalBeforeDate(localId: string, start: Date): Promise<{
    aiMessagesDeleted: number;
    aiSessionsDeleted: number;
    aiSessionsResummarized: number;
  }>;
}
