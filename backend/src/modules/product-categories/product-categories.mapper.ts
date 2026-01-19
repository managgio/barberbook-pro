import { Product, ProductCategory } from '@prisma/client';
import { mapProduct } from '../products/products.mapper';

type ProductCategoryWithProducts = ProductCategory & { products?: (Product & { category?: ProductCategory | null })[] };

export const mapProductCategory = (
  category: ProductCategoryWithProducts,
  options: { includeProducts?: boolean } = {},
) => ({
  id: category.id,
  name: category.name,
  description: category.description ?? '',
  position: category.position,
  products:
    options.includeProducts === false || !category.products
      ? undefined
      : category.products.map((product) => mapProduct(product)),
});
