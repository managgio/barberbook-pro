import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateClientNoteCommand = {
  context: RequestContext;
  noteId: string;
  content: string;
};

