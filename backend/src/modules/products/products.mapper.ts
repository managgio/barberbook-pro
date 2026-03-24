import { computeProductPricing } from './products.pricing';

type ProductWithCategory = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number | { toString(): string };
  position: number;
  stock: number;
  minStock: number | null;
  imageUrl: string | null;
  imageFileId: string | null;
  isActive: boolean;
  isPublic: boolean;
  categoryId: string | null;
  category?:
    | {
        id: string;
        name: string;
        description: string | null;
        position: number;
      }
    | null;
  finalPrice?: number;
  appliedOffer?: {
    id: string;
    name: string;
    description: string;
    discountType: string;
    discountValue: number;
    scope: string;
    startDate: Date | null;
    endDate: Date | null;
    amountOff: number;
  } | null;
};

export const mapProduct = (product: ProductWithCategory, pricing?: ReturnType<typeof computeProductPricing>) => {
  const price = Number(product.price);
  const finalPrice = pricing?.finalPrice ?? product.finalPrice ?? price;
  const appliedOffer = pricing?.appliedOffer ?? product.appliedOffer ?? null;
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? '',
    sku: product.sku ?? null,
    price,
    finalPrice,
    position: product.position,
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
    appliedOffer: appliedOffer
      ? {
          ...appliedOffer,
          amountOff: Number(appliedOffer.amountOff),
        }
      : null,
  };
};
