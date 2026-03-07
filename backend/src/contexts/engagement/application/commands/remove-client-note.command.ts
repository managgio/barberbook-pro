import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveClientNoteCommand = {
  context: RequestContext;
  noteId: string;
};

