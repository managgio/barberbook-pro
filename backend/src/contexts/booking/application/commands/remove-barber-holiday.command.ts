import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveBarberHolidayCommand = {
  context: RequestContext;
  barberId: string;
  range: {
    start: string;
    end: string;
  };
};

