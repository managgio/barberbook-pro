import { AI_ADMIN_ACCESS_READ_PORT, AiAdminAccessReadPort } from '../../ports/outbound/ai-admin-access-read.port';
import { AI_ASSISTANT_MEMORY_PORT, AiAssistantMemoryPort } from '../../ports/outbound/ai-assistant-memory.port';
import {
  AiAssistantNotFoundError,
  AiAssistantValidationError,
} from '../errors/ai-assistant.errors';

export interface GetAiAssistantSessionInput {
  adminUserId: string;
  sessionId: string;
  localId: string;
}

export interface GetAiAssistantSessionResult {
  sessionId: string;
  summary: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
  }>;
}

export class GetAiAssistantSessionUseCase {
  constructor(
    private readonly adminAccessReadPort: AiAdminAccessReadPort,
    private readonly memoryPort: AiAssistantMemoryPort,
  ) {}

  async execute(input: GetAiAssistantSessionInput): Promise<GetAiAssistantSessionResult> {
    await this.ensureAdminUser(input.adminUserId, input.localId);
    const sessionData = await this.memoryPort.getSessionMessages(input.sessionId, input.adminUserId, 80);
    if (!sessionData) {
      throw new AiAssistantNotFoundError('Sesión no encontrada.');
    }
    return {
      sessionId: sessionData.session.id,
      summary: sessionData.session.summary,
      messages: sessionData.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  }

  private async ensureAdminUser(adminUserId: string, localId: string) {
    const user = await this.adminAccessReadPort.findUserById({ userId: adminUserId });
    if (!user) {
      throw new AiAssistantValidationError('Usuario admin inválido.');
    }
    if (user.isSuperAdmin || user.isPlatformAdmin) {
      return;
    }
    const hasStaffMembership = await this.adminAccessReadPort.hasLocationStaffMembership({
      localId,
      userId: adminUserId,
    });
    if (!hasStaffMembership) {
      throw new AiAssistantValidationError('Usuario admin inválido.');
    }
  }
}

export const GET_AI_ASSISTANT_SESSION_USE_CASE = Symbol('GET_AI_ASSISTANT_SESSION_USE_CASE');

export const createGetAiAssistantSessionUseCase = (deps: {
  adminAccessReadPort: AiAdminAccessReadPort;
  memoryPort: AiAssistantMemoryPort;
}) => new GetAiAssistantSessionUseCase(deps.adminAccessReadPort, deps.memoryPort);

export const GET_AI_ASSISTANT_SESSION_USE_CASE_DEPS = {
  adminAccessReadPort: AI_ADMIN_ACCESS_READ_PORT,
  memoryPort: AI_ASSISTANT_MEMORY_PORT,
} as const;
