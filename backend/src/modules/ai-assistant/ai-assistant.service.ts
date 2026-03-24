import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CHAT_WITH_AI_ASSISTANT_USE_CASE,
  ChatWithAiAssistantUseCase,
} from '../../contexts/ai-orchestration/application/use-cases/chat-with-ai-assistant.use-case';
import {
  GET_AI_ASSISTANT_SESSION_USE_CASE,
  GetAiAssistantSessionUseCase,
} from '../../contexts/ai-orchestration/application/use-cases/get-ai-assistant-session.use-case';
import {
  TRANSCRIBE_AI_AUDIO_USE_CASE,
  TranscribeAiAudioUseCase,
} from '../../contexts/ai-orchestration/application/use-cases/transcribe-ai-audio.use-case';
import {
  AiAssistantNotFoundError,
  AiAssistantUnavailableError,
  AiAssistantValidationError,
} from '../../contexts/ai-orchestration/application/errors/ai-assistant.errors';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { AI_TIME_ZONE } from './ai-assistant.utils';

export interface AiChatResult {
  sessionId: string;
  assistantMessage: string;
  actions?: {
    appointmentsChanged?: boolean;
    holidaysChanged?: boolean;
    alertsChanged?: boolean;
  };
}

@Injectable()
export class AiAssistantService {
  constructor(
    @Inject(CHAT_WITH_AI_ASSISTANT_USE_CASE)
    private readonly chatWithAiAssistantUseCase: ChatWithAiAssistantUseCase,
    @Inject(GET_AI_ASSISTANT_SESSION_USE_CASE)
    private readonly getAiAssistantSessionUseCase: GetAiAssistantSessionUseCase,
    @Inject(TRANSCRIBE_AI_AUDIO_USE_CASE)
    private readonly transcribeAiAudioUseCase: TranscribeAiAudioUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  async chat(adminUserId: string, message: string, sessionId?: string | null): Promise<AiChatResult> {
    const localId = this.tenantContextPort.getRequestContext().localId;
    try {
      return await this.chatWithAiAssistantUseCase.execute({
        adminUserId,
        message,
        sessionId,
        localId,
        timeZone: AI_TIME_ZONE,
      });
    } catch (error) {
      this.rethrowAsHttp(error);
    }
  }

  async getSession(adminUserId: string, sessionId: string) {
    const localId = this.tenantContextPort.getRequestContext().localId;
    try {
      return await this.getAiAssistantSessionUseCase.execute({
        adminUserId,
        sessionId,
        localId,
      });
    } catch (error) {
      if (error instanceof AiAssistantNotFoundError) {
        return null;
      }
      this.rethrowAsHttp(error);
    }
  }

  async getLatestSession(adminUserId: string) {
    const localId = this.tenantContextPort.getRequestContext().localId;
    try {
      return await this.getAiAssistantSessionUseCase.execute({
        adminUserId,
        localId,
      });
    } catch (error) {
      if (error instanceof AiAssistantNotFoundError) {
        return null;
      }
      this.rethrowAsHttp(error);
    }
  }

  async transcribeAudio(adminUserId: string, file?: Express.Multer.File) {
    const localId = this.tenantContextPort.getRequestContext().localId;
    try {
      return await this.transcribeAiAudioUseCase.execute({
        adminUserId,
        localId,
        file,
      });
    } catch (error) {
      this.rethrowAsHttp(error);
    }
  }

  private rethrowAsHttp(error: unknown): never {
    if (error instanceof AiAssistantValidationError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof AiAssistantNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof AiAssistantUnavailableError) {
      throw new ServiceUnavailableException(error.message);
    }
    throw error;
  }
}
