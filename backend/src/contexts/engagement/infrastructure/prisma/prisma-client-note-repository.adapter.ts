import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ClientNoteEntity } from '../../domain/entities/client-note.entity';
import { ClientNoteRepositoryPort } from '../../ports/outbound/client-note-repository.port';

const mapClientNoteEntity = (note: {
  id: string;
  localId: string;
  userId: string;
  authorId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}): ClientNoteEntity => ({
  id: note.id,
  localId: note.localId,
  userId: note.userId,
  authorId: note.authorId,
  content: note.content,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
});

@Injectable()
export class PrismaClientNoteRepositoryAdapter implements ClientNoteRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async isClientInBrand(params: { userId: string; brandId: string }): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: params.userId,
        role: 'client',
        brandMemberships: { some: { brandId: params.brandId } },
      },
      select: { id: true },
    });
    return Boolean(user);
  }

  async listByUserAndLocal(params: { userId: string; localId: string }): Promise<ClientNoteEntity[]> {
    const notes = await this.prisma.clientNote.findMany({
      where: { userId: params.userId, localId: params.localId },
      orderBy: { createdAt: 'desc' },
    });
    return notes.map(mapClientNoteEntity);
  }

  countByUserAndLocal(params: { userId: string; localId: string }): Promise<number> {
    return this.prisma.clientNote.count({
      where: { userId: params.userId, localId: params.localId },
    });
  }

  async create(input: {
    localId: string;
    userId: string;
    authorId: string | null;
    content: string;
  }): Promise<ClientNoteEntity> {
    const created = await this.prisma.clientNote.create({
      data: {
        localId: input.localId,
        userId: input.userId,
        authorId: input.authorId,
        content: input.content,
      },
    });
    return mapClientNoteEntity(created);
  }

  async findByIdAndLocal(params: { id: string; localId: string }): Promise<ClientNoteEntity | null> {
    const note = await this.prisma.clientNote.findFirst({
      where: { id: params.id, localId: params.localId },
    });
    return note ? mapClientNoteEntity(note) : null;
  }

  async updateById(id: string, input: { content: string }): Promise<ClientNoteEntity> {
    const updated = await this.prisma.clientNote.update({
      where: { id },
      data: { content: input.content },
    });
    return mapClientNoteEntity(updated);
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.clientNote.delete({ where: { id } });
  }
}

