import { CommerceProductReadPort } from '../../ports/outbound/product-read.port';
import { GetProductsAdminQuery } from '../queries/get-products-admin.query';

export class GetProductsAdminUseCase {
  constructor(private readonly productReadPort: CommerceProductReadPort) {}

  execute(query: GetProductsAdminQuery) {
    return this.productReadPort.listAdminProducts({
      localId: query.context.localId,
      brandId: query.context.brandId,
    });
  }
}
