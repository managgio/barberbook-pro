import { RequestContext } from '../../../../shared/application/request-context';

export type FindUsersByIdsQuery = {
  context: RequestContext;
  ids: string[];
};

