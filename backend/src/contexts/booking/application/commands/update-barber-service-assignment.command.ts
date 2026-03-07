import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateBarberServiceAssignmentCommand = {
  context: RequestContext;
  barberId: string;
  serviceIds?: string[];
  categoryIds?: string[];
};
