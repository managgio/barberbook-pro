import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveServiceCommand = {
  context: RequestContext;
  serviceId: string;
};
