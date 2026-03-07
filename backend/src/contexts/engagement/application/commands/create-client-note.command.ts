import { RequestContext } from '../../../../shared/application/request-context';

export type CreateClientNoteCommand = {
  context: RequestContext;
  userId: string;
  authorId: string | null;
  content: string;
};

