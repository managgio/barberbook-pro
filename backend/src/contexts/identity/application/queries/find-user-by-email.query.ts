import { RequestContext } from '../../../../shared/application/request-context';

export type FindUserByEmailQuery = {
  context: RequestContext;
  email: string;
};

