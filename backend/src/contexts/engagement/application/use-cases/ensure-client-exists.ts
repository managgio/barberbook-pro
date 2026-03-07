import { DomainError } from '../../../../shared/domain/domain-error';
import { ClientNoteRepositoryPort } from '../../ports/outbound/client-note-repository.port';

export const ensureClientExists = async (
  clientNoteRepositoryPort: ClientNoteRepositoryPort,
  params: { userId: string; brandId: string },
) => {
  const exists = await clientNoteRepositoryPort.isClientInBrand({
    userId: params.userId,
    brandId: params.brandId,
  });
  if (!exists) {
    throw new DomainError('Client not found', 'CLIENT_NOT_FOUND');
  }
};

