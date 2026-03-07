import { mapProduct } from '../products/products.mapper';

type ProductCategoryWithProducts = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  products?: unknown[];
};

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
      : category.products.map((product) => mapProduct(product as any)),
});
