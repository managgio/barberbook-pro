import { RequestContext } from '../../../../shared/application/request-context';

export type RecordImageKitUsageCommand = {
  context: RequestContext;
  storageUsedBytes: number;
  storageLimitBytes?: number | null;
  brandId?: string;
};

