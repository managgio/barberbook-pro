import { ClientNoteRepositoryPort } from '../../ports/outbound/client-note-repository.port';
import { ListClientNotesQuery } from '../queries/list-client-notes.query';
import { ensureClientExists } from './ensure-client-exists';

export class ListClientNotesUseCase {
  constructor(private readonly clientNoteRepositoryPort: ClientNoteRepositoryPort) {}

  async execute(query: ListClientNotesQuery) {
    await ensureClientExists(this.clientNoteRepositoryPort, {
      userId: query.userId,
      brandId: query.context.brandId,
    });

    return this.clientNoteRepositoryPort.listByUserAndLocal({
      userId: query.userId,
      localId: query.context.localId,
    });
  }
}

