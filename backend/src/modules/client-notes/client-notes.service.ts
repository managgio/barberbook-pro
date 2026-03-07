import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateClientNoteUseCase } from '../../contexts/engagement/application/use-cases/create-client-note.use-case';
import { ListClientNotesUseCase } from '../../contexts/engagement/application/use-cases/list-client-notes.use-case';
import {
  MAX_CLIENT_NOTES,
  MAX_NOTE_LENGTH,
} from '../../contexts/engagement/application/use-cases/client-note-policy';
import { RemoveClientNoteUseCase } from '../../contexts/engagement/application/use-cases/remove-client-note.use-case';
import { UpdateClientNoteUseCase } from '../../contexts/engagement/application/use-cases/update-client-note.use-case';
import {
  ClientNoteRepositoryPort,
  ENGAGEMENT_CLIENT_NOTE_REPOSITORY_PORT,
} from '../../contexts/engagement/ports/outbound/client-note-repository.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';

@Injectable()
export class ClientNotesService {
  private readonly listClientNotesUseCase: ListClientNotesUseCase;
  private readonly createClientNoteUseCase: CreateClientNoteUseCase;
  private readonly updateClientNoteUseCase: UpdateClientNoteUseCase;
  private readonly removeClientNoteUseCase: RemoveClientNoteUseCase;

  constructor(
    @Inject(ENGAGEMENT_CLIENT_NOTE_REPOSITORY_PORT)
    private readonly clientNoteRepositoryPort: ClientNoteRepositoryPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.listClientNotesUseCase = new ListClientNotesUseCase(this.clientNoteRepositoryPort);
    this.createClientNoteUseCase = new CreateClientNoteUseCase(this.clientNoteRepositoryPort);
    this.updateClientNoteUseCase = new UpdateClientNoteUseCase(this.clientNoteRepositoryPort);
    this.removeClientNoteUseCase = new RemoveClientNoteUseCase(this.clientNoteRepositoryPort);
  }

  async listForUser(userId: string) {
    try {
      return await this.listClientNotesUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        userId,
      });
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async create(userId: string, content: string, authorId: string | null) {
    try {
      return await this.createClientNoteUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        userId,
        content,
        authorId: authorId || null,
      });
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async update(id: string, content: string) {
    try {
      return await this.updateClientNoteUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        noteId: id,
        content,
      });
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.removeClientNoteUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        noteId: id,
      });
      return { success: true };
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  private rethrowHttpError(error: unknown): never | void {
    rethrowDomainErrorAsHttp(error, {
      CLIENT_NOT_FOUND: () => new NotFoundException('Cliente no encontrado.'),
      CLIENT_NOTE_NOT_FOUND: () => new NotFoundException('Nota no encontrada.'),
      CLIENT_NOTE_EMPTY: () => new BadRequestException('La nota no puede estar vacía.'),
      CLIENT_NOTE_TOO_LONG: () =>
        new BadRequestException(`La nota no puede superar ${MAX_NOTE_LENGTH} caracteres.`),
      CLIENT_NOTE_LIMIT_REACHED: () =>
        new BadRequestException(`Solo se permiten ${MAX_CLIENT_NOTES} notas por cliente.`),
    });
  }
}
