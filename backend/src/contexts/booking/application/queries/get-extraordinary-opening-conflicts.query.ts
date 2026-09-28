import { RequestContext } from '../../../../shared/application/request-context';

export type GetExtraordinaryOpeningConflictsQuery = {
  context: RequestContext;
  dateOnly: string;
  allProfessionals: boolean;
  barberIds: string[];
};
