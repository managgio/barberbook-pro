import { RequestContext } from '../../../../shared/application/request-context';

export type ListCashMovementsCommand = {
  context: RequestContext;
  date: string;
};

