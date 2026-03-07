import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveGeneralHolidayCommand = {
  context: RequestContext;
  range: {
    start: string;
    end: string;
  };
};

