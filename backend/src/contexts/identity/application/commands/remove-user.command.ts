import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveUserCommand = {
  context: RequestContext;
  userId: string;
};
