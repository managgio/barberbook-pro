import { RequestContext } from '../../../../shared/application/request-context';

export type GetBarberScheduleQuery = {
  context: RequestContext;
  barberId: string;
};

