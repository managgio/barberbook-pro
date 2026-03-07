import { RequestContext } from '../../../../shared/application/request-context';

export type RecordTwilioUsageCommand = {
  context: RequestContext;
  messages?: number;
  costUsd?: number | null;
  brandId?: string;
};

