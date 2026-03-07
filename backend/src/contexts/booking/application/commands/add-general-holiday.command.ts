import { RequestContext } from '../../../../shared/application/request-context';

export type AddGeneralHolidayCommand = {
  context: RequestContext;
  range: {
    start: string;
    end: string;
  };
};

