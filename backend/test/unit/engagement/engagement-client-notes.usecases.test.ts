import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateClientNoteUseCase } from '@/contexts/engagement/application/use-cases/create-client-note.use-case';
import { ListClientNotesUseCase } from '@/contexts/engagement/application/use-cases/list-client-notes.use-case';
import { UpdateClientNoteUseCase } from '@/contexts/engagement/application/use-cases/update-client-note.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'admin-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-engagement-client-notes-1',
};

test('list client notes throws CLIENT_NOT_FOUND when client is outside brand scope', async () => {
  const useCase = new ListClientNotesUseCase({
    isClientInBrand: async () => false,
    listByUserAndLocal: async () => [],
    countByUserAndLocal: async () => 0,
    create: async () => {
      throw new Error('not used');
    },
    findByIdAndLocal: async () => null,
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        userId: 'client-1',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'CLIENT_NOT_FOUND',
  );
});

test('create client note enforces note limit', async () => {
  const useCase = new CreateClientNoteUseCase({
    isClientInBrand: async () => true,
    listByUserAndLocal: async () => [],
    countByUserAndLocal: async () => 5,
    create: async () => {
      throw new Error('not used');
    },
    findByIdAndLocal: async () => null,
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        userId: 'client-1',
        authorId: 'admin-1',
        content: 'Valid content',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'CLIENT_NOTE_LIMIT_REACHED',
  );
});

test('update client note validates content and tenant scope', async () => {
  const useCase = new UpdateClientNoteUseCase({
    isClientInBrand: async () => true,
    listByUserAndLocal: async () => [],
    countByUserAndLocal: async () => 0,
    create: async () => {
      throw new Error('not used');
    },
    findByIdAndLocal: async () => ({
      id: 'note-1',
      localId: 'local-1',
      userId: 'client-1',
      authorId: null,
      content: 'before',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateById: async (id, input) => ({
      id,
      localId: 'local-1',
      userId: 'client-1',
      authorId: null,
      content: input.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    deleteById: async () => undefined,
  });

  const updated = await useCase.execute({
    context: requestContext,
    noteId: 'note-1',
    content: '  trimmed  ',
  });

  assert.equal(updated.content, 'trimmed');
});

