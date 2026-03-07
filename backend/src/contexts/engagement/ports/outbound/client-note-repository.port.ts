import { ClientNoteEntity } from '../../domain/entities/client-note.entity';

export const ENGAGEMENT_CLIENT_NOTE_REPOSITORY_PORT = Symbol('ENGAGEMENT_CLIENT_NOTE_REPOSITORY_PORT');

export interface ClientNoteRepositoryPort {
  isClientInBrand(params: { userId: string; brandId: string }): Promise<boolean>;
  listByUserAndLocal(params: { userId: string; localId: string }): Promise<ClientNoteEntity[]>;
  countByUserAndLocal(params: { userId: string; localId: string }): Promise<number>;
  create(input: {
    localId: string;
    userId: string;
    authorId: string | null;
    content: string;
  }): Promise<ClientNoteEntity>;
  findByIdAndLocal(params: { id: string; localId: string }): Promise<ClientNoteEntity | null>;
  updateById(id: string, input: { content: string }): Promise<ClientNoteEntity>;
  deleteById(id: string): Promise<void>;
}

