import { RequestContext } from '../../../../shared/application/request-context';

export type ImportProductsCommand = {
  context: RequestContext;
  sourceLocalId: string;
  targetLocalId?: string;
};
