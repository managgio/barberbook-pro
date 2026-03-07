import { RequestContext } from '../../../../shared/application/request-context';

export type FindUserByIdQuery = {
  context: RequestContext;
  userId: string;
};

