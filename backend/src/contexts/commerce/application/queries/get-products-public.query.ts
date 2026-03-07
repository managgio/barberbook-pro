import { RequestContext } from '../../../../shared/application/request-context';

export type GetProductsPublicQuery = {
  context: RequestContext;
  contextView: 'landing' | 'booking';
};
