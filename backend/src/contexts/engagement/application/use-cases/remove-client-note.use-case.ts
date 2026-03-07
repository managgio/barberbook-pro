import { DomainError } from '../../../../shared/domain/domain-error';
import { ClientNoteRepositoryPort } from '../../ports/outbound/client-note-repository.port';
import { RemoveClientNoteCommand } from '../commands/remove-client-note.command';

export class RemoveClientNoteUseCase {
  constructor(private readonly clientNoteRepositoryPort: ClientNoteRepositoryPort) {}

  async execute(command: RemoveClientNoteCommand) {
    const existing = await this.clientNoteRepositoryPort.findByIdAndLocal({
      id: command.noteId,
      localId: command.context.localId,
    });
    if (!existing) {
      throw new DomainError('Client note not found', 'CLIENT_NOTE_NOT_FOUND');
    }

    await this.clientNoteRepositoryPort.deleteById(command.noteId);
  }
}

