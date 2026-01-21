import { Product, ProductCategory } from '@prisma/client';
import { computeProductPricing } from './products.pricing';

type ProductWithCategory = Product & { category?: ProductCategory | null };

export const mapProduct = (product: ProductWithCategory, pricing?: ReturnType<typeof computeProductPricing>) => {
  const price = Number(product.price);
  const finalPrice = pricing?.finalPrice ?? price;
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? '',
    sku: product.sku ?? null,
    price,
    finalPrice,
    stock: product.stock,
    minStock: product.minStock ?? 0,
    imageUrl: product.imageUrl ?? null,
    imageFileId: product.imageFileId ?? null,
    isActive: product.isActive,
    isPublic: product.isPublic,
    categoryId: product.categoryId,
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          description: product.category.description ?? '',
          position: product.category.position,
        }
      : null,
    appliedOffer: pricing?.appliedOffer
      ? {
          ...pricing.appliedOffer,
          amountOff: Number(pricing.appliedOffer.amountOff),
        }
      : null,
  };
};
