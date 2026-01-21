import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { mapProduct } from './products.mapper';
import { computeProductPricing } from './products.pricing';
import { isOfferActiveNow } from '../services/services.pricing';
import { areProductCategoriesEnabled, getProductSettings } from './products.utils';
import { normalizeSettings, SiteSettings } from '../settings/settings.types';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeName(value: string) {
    return value.trim().toLowerCase();
  }

  private async findProductByName(localId: string, name: string) {
    const normalizedName = this.normalizeName(name);
    const candidates = await this.prisma.product.findMany({
      where: { localId },
      select: { id: true, name: true },
    });
    return candidates.find((candidate) => this.normalizeName(candidate.name) === normalizedName) ?? null;
  }

  private async assertCategoryExists(categoryId: string) {
    const localId = getCurrentLocalId();
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, localId },
    });
    if (!category) throw new NotFoundException('Category not found');
  }

  private async assertProductsEnabled() {
    const settings = await getProductSettings(this.prisma);
    if (!settings.enabled) {
      throw new BadRequestException('El control de productos no está habilitado en este local.');
    }
  }

  private async getProductOffers(referenceDate: Date) {
    const localId = getCurrentLocalId();
    const offers = await this.prisma.offer.findMany({
      where: { active: true, localId, target: 'product' },
      include: { productCategories: true, products: true },
    });
    return offers.filter((offer) => isOfferActiveNow(offer, referenceDate));
  }

  private mapWithPricing(products: any[], offers: any[], referenceDate: Date) {
    return products.map((product) =>
      mapProduct(product, computeProductPricing(product, offers, referenceDate)),
    );
  }

  async findAllAdmin() {
    const localId = getCurrentLocalId();
    const [products, offers] = await Promise.all([
      this.prisma.product.findMany({
        where: { localId },
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      this.getProductOffers(new Date()),
    ]);
    return this.mapWithPricing(products, offers, new Date());
  }

  async findPublic(context: 'landing' | 'booking' = 'booking') {
    const localId = getCurrentLocalId();
    const settings = await getProductSettings(this.prisma);
    if (!settings.enabled) return [];
    if (context === 'landing' && !settings.showOnLanding) return [];
    if (context === 'booking' && !settings.clientPurchaseEnabled) return [];

    const [products, offers] = await Promise.all([
      this.prisma.product.findMany({
        where: { localId, isActive: true, isPublic: true },
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      this.getProductOffers(new Date()),
    ]);
    return this.mapWithPricing(products, offers, new Date());
  }

  async create(data: CreateProductDto) {
    await this.assertProductsEnabled();
    const localId = getCurrentLocalId();
    const name = data.name.trim();
    const categoriesEnabled = await areProductCategoriesEnabled(this.prisma);
    const categoryId = data.categoryId ?? null;
    if (categoriesEnabled && !categoryId) {
      throw new BadRequestException('Debes asignar una categoría porque la categorización está activa.');
    }
    if (categoryId) {
      await this.assertCategoryExists(categoryId);
    }

    const payload = {
      name,
      description: data.description ?? '',
      sku: data.sku ?? null,
      price: data.price,
      stock: data.stock ?? 0,
      minStock: data.minStock ?? 0,
      categoryId,
      imageUrl: data.imageUrl ?? null,
      imageFileId: data.imageFileId ?? null,
      isActive: data.isActive ?? true,
      isPublic: data.isPublic ?? true,
    };

    const existing = await this.findProductByName(localId, name);
    const created = existing
      ? await this.prisma.product.update({
          where: { id: existing.id },
          data: payload,
          include: { category: true },
        })
      : await this.prisma.product.create({
          data: { localId, ...payload },
          include: { category: true },
        });
    const offers = await this.getProductOffers(new Date());
    return mapProduct(created, computeProductPricing(created, offers, new Date()));
  }

  async update(id: string, data: UpdateProductDto) {
    await this.assertProductsEnabled();
    const localId = getCurrentLocalId();
    const existing = await this.prisma.product.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Product not found');
    const categoriesEnabled = await areProductCategoriesEnabled(this.prisma);
    const categoryId = data.categoryId === undefined ? existing.categoryId : data.categoryId;
    if (categoriesEnabled && !categoryId) {
      throw new BadRequestException('Debes asignar una categoría porque la categorización está activa.');
    }
    if (categoryId) {
      await this.assertCategoryExists(categoryId);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        sku: data.sku,
        price: data.price,
        stock: data.stock,
        minStock: data.minStock,
        categoryId: categoryId ?? null,
        imageUrl: data.imageUrl,
        imageFileId: data.imageFileId,
        isActive: data.isActive,
        isPublic: data.isPublic,
      },
      include: { category: true },
    });
    const offers = await this.getProductOffers(new Date());
    return mapProduct(updated, computeProductPricing(updated, offers, new Date()));
  }

  async remove(id: string) {
    await this.assertProductsEnabled();
    const localId = getCurrentLocalId();
    const existing = await this.prisma.product.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Product not found');
    const inAppointments = await this.prisma.appointmentProduct.count({
      where: { productId: id },
    });
    if (inAppointments > 0) {
      throw new BadRequestException('No puedes eliminar un producto que ya se usó en citas.');
    }
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }

  private async getSettingsForLocal(localId: string) {
    const settings = await this.prisma.siteSettings.findUnique({ where: { localId } });
    const normalized = normalizeSettings((settings?.data || undefined) as Partial<SiteSettings> | undefined);
    return normalized.products;
  }

  async importFromLocal(sourceLocalId: string, targetLocalId?: string) {
    const currentLocalId = getCurrentLocalId();
    const destinationLocalId = targetLocalId ?? currentLocalId;
    const locals = await this.prisma.location.findMany({
      where: { id: { in: [sourceLocalId, destinationLocalId] } },
    });
    const source = locals.find((loc) => loc.id === sourceLocalId) || null;
    const destination = locals.find((loc) => loc.id === destinationLocalId) || null;
    if (!source || !destination) {
      throw new NotFoundException('Local no encontrado.');
    }
    if (source.brandId !== destination.brandId) {
      throw new BadRequestException('Solo puedes importar productos entre locales de la misma marca.');
    }

    const destinationSettings = await this.getSettingsForLocal(destinationLocalId);
    if (!destinationSettings.enabled) {
      throw new BadRequestException('El local destino no tiene habilitado el control de productos.');
    }

    return this.prisma.$transaction(async (tx) => {
      const [sourceCategories, destinationCategories, sourceProducts, destinationProducts] = await Promise.all([
        tx.productCategory.findMany({ where: { localId: sourceLocalId } }),
        tx.productCategory.findMany({ where: { localId: destinationLocalId } }),
        tx.product.findMany({ where: { localId: sourceLocalId }, include: { category: true } }),
        tx.product.findMany({ where: { localId: destinationLocalId } }),
      ]);

      const destinationCategoryByName = new Map(
        destinationCategories.map((cat) => [this.normalizeName(cat.name), cat]),
      );
      const destinationProductByName = new Map(
        destinationProducts.map((product) => [this.normalizeName(product.name), product]),
      );

      let created = 0;
      let updated = 0;

      for (const sourceProduct of sourceProducts) {
        let targetCategoryId: string | null = null;
        if (sourceProduct.category) {
          const categoryKey = this.normalizeName(sourceProduct.category.name);
          let targetCategory = destinationCategoryByName.get(categoryKey);
          if (!targetCategory) {
            targetCategory = await tx.productCategory.create({
              data: {
                localId: destinationLocalId,
                name: sourceProduct.category.name,
                description: sourceProduct.category.description ?? '',
                position: sourceProduct.category.position ?? 0,
              },
            });
            destinationCategoryByName.set(categoryKey, targetCategory);
          } else {
            await tx.productCategory.update({
              where: { id: targetCategory.id },
              data: {
                description: sourceProduct.category.description ?? '',
                position: sourceProduct.category.position ?? targetCategory.position,
              },
            });
          }
          targetCategoryId = targetCategory.id;
        }

        const productKey = this.normalizeName(sourceProduct.name);
        const existingProduct = destinationProductByName.get(productKey);
        const payload = {
          localId: destinationLocalId,
          name: sourceProduct.name,
          description: sourceProduct.description ?? '',
          sku: sourceProduct.sku ?? null,
          price: sourceProduct.price,
          stock: sourceProduct.stock,
          minStock: sourceProduct.minStock ?? 0,
          categoryId: targetCategoryId,
          imageUrl: sourceProduct.imageUrl ?? null,
          imageFileId: sourceProduct.imageFileId ?? null,
          isActive: sourceProduct.isActive,
          isPublic: sourceProduct.isPublic,
        };

        if (existingProduct) {
          await tx.product.update({
            where: { id: existingProduct.id },
            data: payload,
          });
          updated += 1;
        } else {
          const createdProduct = await tx.product.create({ data: payload });
          destinationProductByName.set(productKey, createdProduct);
          created += 1;
        }
      }

      return { created, updated };
    });
  }
}
