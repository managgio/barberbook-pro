import { RequestContext } from '../../../../shared/application/request-context';

export type GetBarberHolidaysQuery = {
  context: RequestContext;
  barberId: string;
};

