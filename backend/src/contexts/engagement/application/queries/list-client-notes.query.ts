import { RequestContext } from '../../../../shared/application/request-context';

export type ListClientNotesQuery = {
  context: RequestContext;
  userId: string;
};

