import { RequestContext } from '../../../../shared/application/request-context';
import { ExtraordinaryOpeningsByDate } from '../../domain/value-objects/schedule';

export type UpdateExtraordinaryOpeningsCommand = {
  context: RequestContext;
  openings: ExtraordinaryOpeningsByDate;
};
