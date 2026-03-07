import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveCashMovementCommand = {
  context: RequestContext;
  movementId: string;
};

