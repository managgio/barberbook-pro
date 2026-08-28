import { RequestContext } from '../../../../shared/application/request-context';

export type GetHolidayAppointmentImpactQuery = {
  context: RequestContext;
  range: {
    start: string;
    end?: string;
  };
  barberId?: string;
};
