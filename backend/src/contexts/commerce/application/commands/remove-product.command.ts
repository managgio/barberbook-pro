import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveProductCommand = {
  context: RequestContext;
  productId: string;
};
