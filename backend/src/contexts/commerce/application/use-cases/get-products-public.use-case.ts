import { CommerceProductReadPort } from '../../ports/outbound/product-read.port';
import { GetProductsPublicQuery } from '../queries/get-products-public.query';

export class GetProductsPublicUseCase {
  constructor(private readonly productReadPort: CommerceProductReadPort) {}

  execute(query: GetProductsPublicQuery) {
    return this.productReadPort.listPublicProducts({
      localId: query.context.localId,
      brandId: query.context.brandId,
      context: query.contextView,
    });
  }
}
