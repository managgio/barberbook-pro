import { RequestContext } from '../../../../shared/application/request-context';

export type RecordMessagingUsageCommand = {
  context: RequestContext;
  channel: 'sms' | 'whatsapp';
  messages?: number;
  costUsd?: number | null;
  brandId?: string;
};
