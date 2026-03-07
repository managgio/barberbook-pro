import { RequestContext } from '../../../../shared/application/request-context';

export type AddBarberHolidayCommand = {
  context: RequestContext;
  barberId: string;
  range: {
    start: string;
    end: string;
  };
};

