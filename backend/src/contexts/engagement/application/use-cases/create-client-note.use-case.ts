import { DomainError } from '../../../../shared/domain/domain-error';
import { ClientNoteRepositoryPort } from '../../ports/outbound/client-note-repository.port';
import { CreateClientNoteCommand } from '../commands/create-client-note.command';
import { ensureClientExists } from './ensure-client-exists';
import {
  MAX_CLIENT_NOTES,
  normalizeAndValidateClientNoteContent,
} from './client-note-policy';

export class CreateClientNoteUseCase {
  constructor(private readonly clientNoteRepositoryPort: ClientNoteRepositoryPort) {}

  async execute(command: CreateClientNoteCommand) {
    await ensureClientExists(this.clientNoteRepositoryPort, {
      userId: command.userId,
      brandId: command.context.brandId,
    });

    const content = normalizeAndValidateClientNoteContent(command.content);
    const existingCount = await this.clientNoteRepositoryPort.countByUserAndLocal({
      userId: command.userId,
      localId: command.context.localId,
    });

    if (existingCount >= MAX_CLIENT_NOTES) {
      throw new DomainError('Client note limit reached', 'CLIENT_NOTE_LIMIT_REACHED');
    }

    return this.clientNoteRepositoryPort.create({
      localId: command.context.localId,
      userId: command.userId,
      authorId: command.authorId,
      content,
    });
  }
}

