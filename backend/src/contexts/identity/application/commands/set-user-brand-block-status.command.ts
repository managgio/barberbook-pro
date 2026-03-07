import { RequestContext } from '../../../../shared/application/request-context';

export type SetUserBrandBlockStatusCommand = {
  context: RequestContext;
  userId: string;
  isBlocked: boolean;
};
