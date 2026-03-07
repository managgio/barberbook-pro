import { AI_ADMIN_ACCESS_READ_PORT, AiAdminAccessReadPort } from '../../ports/outbound/ai-admin-access-read.port';
import { AI_LLM_PORT, AiLlmPort } from '../../ports/outbound/ai-llm.port';
import { AI_TENANT_CONFIG_PORT, AiTenantConfigPort } from '../../ports/outbound/ai-tenant-config.port';
import {
  AiAssistantValidationError,
} from '../errors/ai-assistant.errors';

export interface TranscribeAiAudioInput {
  adminUserId: string;
  localId: string;
  file?: {
    buffer: Buffer;
    size: number;
    mimetype?: string;
    originalname?: string;
  };
}

export interface TranscribeAiAudioResult {
  text: string;
}

export class TranscribeAiAudioUseCase {
  constructor(
    private readonly adminAccessReadPort: AiAdminAccessReadPort,
    private readonly tenantConfigPort: AiTenantConfigPort,
    private readonly llmPort: AiLlmPort,
  ) {}

  async execute(input: TranscribeAiAudioInput): Promise<TranscribeAiAudioResult> {
    await this.ensureAdminUser(input.adminUserId, input.localId);
    if (!input.file) {
      throw new AiAssistantValidationError('Archivo de audio requerido.');
    }
    if (input.file.size > 10 * 1024 * 1024) {
      throw new AiAssistantValidationError('El audio supera el tamaño máximo de 10MB.');
    }
    const isAudio = input.file.mimetype?.startsWith('audio/');
    const isWebm = input.file.mimetype === 'video/webm';
    if (!isAudio && !isWebm && input.file.mimetype !== 'application/octet-stream') {
      throw new AiAssistantValidationError('Formato de audio no soportado.');
    }

    const transcriptionConfig = await this.tenantConfigPort.getTranscriptionConfig();
    if (transcriptionConfig.provider !== 'openai') {
      throw new AiAssistantValidationError('Proveedor IA no soportado.');
    }
    if (!transcriptionConfig.apiKey) {
      throw new AiAssistantValidationError('Falta AI_API_KEY en el entorno.');
    }

    const response = await this.llmPort.transcribeAudio({
      apiKey: transcriptionConfig.apiKey,
      model: transcriptionConfig.model,
      language: transcriptionConfig.language,
      temperature: transcriptionConfig.temperature,
      buffer: input.file.buffer,
      fileName: input.file.originalname || 'audio.webm',
      mimeType: input.file.mimetype || 'audio/webm',
    });

    return { text: response.text?.trim() || '' };
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

export const TRANSCRIBE_AI_AUDIO_USE_CASE = Symbol('TRANSCRIBE_AI_AUDIO_USE_CASE');

export const createTranscribeAiAudioUseCase = (deps: {
  adminAccessReadPort: AiAdminAccessReadPort;
  tenantConfigPort: AiTenantConfigPort;
  llmPort: AiLlmPort;
}) =>
  new TranscribeAiAudioUseCase(
    deps.adminAccessReadPort,
    deps.tenantConfigPort,
    deps.llmPort,
  );

export const TRANSCRIBE_AI_AUDIO_USE_CASE_DEPS = {
  adminAccessReadPort: AI_ADMIN_ACCESS_READ_PORT,
  tenantConfigPort: AI_TENANT_CONFIG_PORT,
  llmPort: AI_LLM_PORT,
} as const;
