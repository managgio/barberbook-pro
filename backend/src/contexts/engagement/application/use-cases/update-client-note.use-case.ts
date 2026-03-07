import { DomainError } from '../../../../shared/domain/domain-error';
import { ClientNoteRepositoryPort } from '../../ports/outbound/client-note-repository.port';
import { UpdateClientNoteCommand } from '../commands/update-client-note.command';
import { normalizeAndValidateClientNoteContent } from './client-note-policy';

export class UpdateClientNoteUseCase {
  constructor(private readonly clientNoteRepositoryPort: ClientNoteRepositoryPort) {}

  async execute(command: UpdateClientNoteCommand) {
    const existing = await this.clientNoteRepositoryPort.findByIdAndLocal({
      id: command.noteId,
      localId: command.context.localId,
    });
    if (!existing) {
      throw new DomainError('Client note not found', 'CLIENT_NOTE_NOT_FOUND');
    }

    const content = normalizeAndValidateClientNoteContent(command.content);
    return this.clientNoteRepositoryPort.updateById(command.noteId, { content });
  }
}

