import { DomainError } from '../../../../shared/domain/domain-error';

export const MAX_CLIENT_NOTES = 5;
export const MAX_NOTE_LENGTH = 150;

export const normalizeAndValidateClientNoteContent = (content: string): string => {
  const normalized = content.trim();
  if (!normalized) {
    throw new DomainError('Note cannot be empty', 'CLIENT_NOTE_EMPTY');
  }
  if (normalized.length > MAX_NOTE_LENGTH) {
    throw new DomainError('Note exceeds max length', 'CLIENT_NOTE_TOO_LONG');
  }
  return normalized;
};

