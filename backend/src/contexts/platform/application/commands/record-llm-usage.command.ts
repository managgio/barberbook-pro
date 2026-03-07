import { RequestContext } from '../../../../shared/application/request-context';

export type RecordOpenAiUsageCommand = {
  context: RequestContext;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  brandId?: string;
};

