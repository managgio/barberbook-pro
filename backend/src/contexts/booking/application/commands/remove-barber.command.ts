import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveBarberCommand = {
  context: RequestContext;
  barberId: string;
};
