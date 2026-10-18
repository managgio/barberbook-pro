import { RequestContext } from '../../../../shared/application/request-context';

export type RecordMessagingUsageCommand = {
  context: RequestContext;
  messages?: number;
  costUsd?: number | null;
  brandId?: string;
};
