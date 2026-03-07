import { Injectable } from '@nestjs/common';
import { DiscountType, OfferScope, OfferTarget } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  CommerceOfferForUpdate,
  CommerceOfferManagementPort,
  CommerceOfferScope,
  CreateCommerceOfferInput,
  UpdateCommerceOfferInput,
} from '../../ports/outbound/offer-management.port';

const toPrismaOfferTarget = (target: 'service' | 'product'): OfferTarget =>
  target === 'product' ? OfferTarget.product : OfferTarget.service;

const toPrismaOfferScope = (scope: CommerceOfferScope): OfferScope => {
  if (scope === 'categories') return OfferScope.categories;
  if (scope === 'services') return OfferScope.services;
  if (scope === 'products') return OfferScope.products;
  return OfferScope.all;
};

@Injectable()
export class PrismaOfferManagementAdapter implements CommerceOfferManagementPort {
  constructor(private readonly prisma: PrismaService) {}

  async createOffer(params: {
    localId: string;
    input: CreateCommerceOfferInput;
  }): Promise<{ id: string }> {
    const created = await this.prisma.offer.create({
      data: {
        localId: params.localId,
        name: params.input.name,
        description: params.input.description,
        discountType: params.input.discountType as DiscountType,
        discountValue: params.input.discountValue,
        scope: toPrismaOfferScope(params.input.scope),
        target: toPrismaOfferTarget(params.input.target),
        startDate: params.input.startDate,
        endDate: params.input.endDate,
        active: params.input.active,
        categories:
          params.input.target === 'service' &&
          params.input.scope === 'categories' &&
          params.input.categoryIds
            ? { connect: params.input.categoryIds.map((id) => ({ id })) }
            : undefined,
        services:
          params.input.target === 'service' &&
          params.input.scope === 'services' &&
          params.input.serviceIds
            ? { connect: params.input.serviceIds.map((id) => ({ id })) }
            : undefined,
        productCategories:
          params.input.target === 'product' &&
          params.input.scope === 'categories' &&
          params.input.productCategoryIds
            ? { connect: params.input.productCategoryIds.map((id) => ({ id })) }
            : undefined,
        products:
          params.input.target === 'product' &&
          params.input.scope === 'products' &&
          params.input.productIds
            ? { connect: params.input.productIds.map((id) => ({ id })) }
            : undefined,
      },
      select: { id: true },
    });

    return { id: created.id };
  }

  async findOfferForUpdate(params: {
    localId: string;
    offerId: string;
  }): Promise<CommerceOfferForUpdate | null> {
    const offer = await this.prisma.offer.findFirst({
      where: {
        id: params.offerId,
        localId: params.localId,
      },
      select: {
        id: true,
        target: true,
        scope: true,
      },
    });
    if (!offer) {
      return null;
    }

    return {
      id: offer.id,
      target: offer.target,
      scope: offer.scope,
    };
  }

  async updateOffer(params: {
    localId: string;
    offerId: string;
    resolvedTarget: 'service' | 'product';
    resolvedScope: CommerceOfferScope;
    input: UpdateCommerceOfferInput;
  }): Promise<{ id: string } | null> {
    const existing = await this.prisma.offer.findFirst({
      where: {
        id: params.offerId,
        localId: params.localId,
      },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }

    const targetProvided = params.input.target !== undefined;
    const scopeProvided = params.input.scope !== undefined;

    const updated = await this.prisma.offer.update({
      where: { id: params.offerId },
      data: {
        name: params.input.name,
        description: params.input.description,
        discountType: params.input.discountType as DiscountType | undefined,
        discountValue: params.input.discountValue,
        scope:
          params.input.scope === undefined ? undefined : toPrismaOfferScope(params.input.scope),
        target:
          params.input.target === undefined ? undefined : toPrismaOfferTarget(params.input.target),
        startDate: params.input.startDate,
        endDate: params.input.endDate,
        active: params.input.active,
        categories:
          params.resolvedTarget === 'service' && params.resolvedScope === 'categories'
            ? {
                set: params.input.categoryIds?.map((id) => ({ id })) ?? [],
              }
            : !scopeProvided && !targetProvided
            ? undefined
            : { set: [] },
        services:
          params.resolvedTarget === 'service' && params.resolvedScope === 'services'
            ? {
                set: params.input.serviceIds?.map((id) => ({ id })) ?? [],
              }
            : !scopeProvided && !targetProvided
            ? undefined
            : { set: [] },
        productCategories:
          params.resolvedTarget === 'product' && params.resolvedScope === 'categories'
            ? {
                set: params.input.productCategoryIds?.map((id) => ({ id })) ?? [],
              }
            : !scopeProvided && !targetProvided
            ? undefined
            : { set: [] },
        products:
          params.resolvedTarget === 'product' && params.resolvedScope === 'products'
            ? {
                set: params.input.productIds?.map((id) => ({ id })) ?? [],
              }
            : !scopeProvided && !targetProvided
            ? undefined
            : { set: [] },
      },
      select: { id: true },
    });

    return { id: updated.id };
  }

  async deleteOffer(params: { localId: string; offerId: string }): Promise<boolean> {
    const existing = await this.prisma.offer.findFirst({
      where: { id: params.offerId, localId: params.localId },
      select: { id: true },
    });
    if (!existing) {
      return false;
    }

    await this.prisma.offer.delete({
      where: { id: params.offerId },
    });
    return true;
  }
}
