import { RequestContext } from '../../../../shared/application/request-context';

export type GetBarberByIdQuery = {
  context: RequestContext;
  barberId: string;
};
