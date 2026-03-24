import { Injectable } from '@nestjs/common';
import { OfferTarget } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommerceProductReadModel } from '../../domain/entities/product-read.entity';
import { CommerceProductReadPort } from '../../ports/outbound/product-read.port';
import { getProductSettings } from './support/commerce-settings.policy';
import { isOfferActiveNow } from './support/offer-active.policy';
import { computeProductPricing } from './support/product-pricing.policy';

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  position: number;
  stock: number;
  minStock: number | null;
  imageUrl: string | null;
  imageFileId: string | null;
  isActive: boolean;
  isPublic: boolean;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    description: string | null;
    position: number;
  } | null;
};

@Injectable()
export class PrismaProductReadAdapter implements CommerceProductReadPort {
  constructor(private readonly prisma: PrismaService) {}

  private toReadModel(
    product: ProductRow,
    pricing: ReturnType<typeof computeProductPricing>,
  ): CommerceProductReadModel {
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      sku: product.sku ?? null,
      price: Number(product.price),
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
      finalPrice: pricing.finalPrice,
      appliedOffer: pricing.appliedOffer
        ? {
            ...pricing.appliedOffer,
            amountOff: Number(pricing.appliedOffer.amountOff),
          }
        : null,
    };
  }

  private async getActiveProductOffers(localId: string, now: Date) {
    const offers = await this.prisma.offer.findMany({
      where: { active: true, localId, target: OfferTarget.product },
      include: { productCategories: true, products: true },
    });
    return offers.filter((offer) => isOfferActiveNow(offer, now));
  }

  async listAdminProducts(params: { localId: string; brandId: string }): Promise<CommerceProductReadModel[]> {
    const now = new Date();
    const [products, offers] = await Promise.all([
      this.prisma.product.findMany({
        where: { localId: params.localId, isArchived: false },
        orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
        include: { category: true },
      }),
      this.getActiveProductOffers(params.localId, now),
    ]);

    return products.map((product) =>
      this.toReadModel(
        product as unknown as ProductRow,
        computeProductPricing(product as any, offers as any, now),
      ),
    );
  }

  async listPublicProducts(params: {
    localId: string;
    brandId: string;
    context: 'landing' | 'booking';
  }): Promise<CommerceProductReadModel[]> {
    const settings = await getProductSettings(this.prisma, {
      localId: params.localId,
      brandId: params.brandId,
    });

    if (!settings.enabled) return [];
    if (params.context === 'landing' && !settings.showOnLanding) return [];
    if (params.context === 'booking' && !settings.clientPurchaseEnabled) return [];

    const now = new Date();
    const [products, offers] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          localId: params.localId,
          isActive: true,
          isPublic: true,
          isArchived: false,
        },
        orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
        include: { category: true },
      }),
      this.getActiveProductOffers(params.localId, now),
    ]);

    return products.map((product) =>
      this.toReadModel(
        product as unknown as ProductRow,
        computeProductPricing(product as any, offers as any, now),
      ),
    );
  }

  async getProductById(params: {
    localId: string;
    brandId: string;
    productId: string;
    includeArchived: boolean;
  }): Promise<CommerceProductReadModel | null> {
    const now = new Date();
    const [product, offers] = await Promise.all([
      this.prisma.product.findFirst({
        where: params.includeArchived
          ? { id: params.productId, localId: params.localId }
          : { id: params.productId, localId: params.localId, isArchived: false },
        include: { category: true },
      }),
      this.getActiveProductOffers(params.localId, now),
    ]);

    if (!product) return null;

    return this.toReadModel(
      product as unknown as ProductRow,
      computeProductPricing(product as any, offers as any, now),
    );
  }
}
