import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOfferUseCase } from '../../contexts/commerce/application/use-cases/create-offer.use-case';
import { GetActiveOffersUseCase } from '../../contexts/commerce/application/use-cases/get-active-offers.use-case';
import { GetOffersUseCase } from '../../contexts/commerce/application/use-cases/get-offers.use-case';
import { RemoveOfferUseCase } from '../../contexts/commerce/application/use-cases/remove-offer.use-case';
import { UpdateOfferUseCase } from '../../contexts/commerce/application/use-cases/update-offer.use-case';
import { CommerceOfferTarget } from '../../contexts/commerce/domain/entities/offer-read.entity';
import {
  COMMERCE_OFFER_MANAGEMENT_PORT,
  CommerceOfferManagementPort,
} from '../../contexts/commerce/ports/outbound/offer-management.port';
import {
  COMMERCE_OFFER_READ_PORT,
  CommerceOfferReadPort,
} from '../../contexts/commerce/ports/outbound/offer-read.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { mapOffer } from './offers.mapper';
import { OfferTarget } from '@prisma/client';

@Injectable()
export class OffersService {
  private readonly getOffersUseCase: GetOffersUseCase;
  private readonly getActiveOffersUseCase: GetActiveOffersUseCase;
  private readonly createOfferUseCase: CreateOfferUseCase;
  private readonly updateOfferUseCase: UpdateOfferUseCase;
  private readonly removeOfferUseCase: RemoveOfferUseCase;

  constructor(
    @Inject(COMMERCE_OFFER_READ_PORT)
    private readonly offerReadPort: CommerceOfferReadPort,
    @Inject(COMMERCE_OFFER_MANAGEMENT_PORT)
    private readonly offerManagementPort: CommerceOfferManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.getOffersUseCase = new GetOffersUseCase(this.offerReadPort);
    this.getActiveOffersUseCase = new GetActiveOffersUseCase(this.offerReadPort);
    this.createOfferUseCase = new CreateOfferUseCase(this.offerManagementPort, this.offerReadPort);
    this.updateOfferUseCase = new UpdateOfferUseCase(this.offerManagementPort, this.offerReadPort);
    this.removeOfferUseCase = new RemoveOfferUseCase(this.offerManagementPort);
  }

  async findAll(target?: OfferTarget) {
    const offers = await this.getOffersUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      target: target as CommerceOfferTarget | undefined,
    });
    return offers.map(mapOffer);
  }

  async findActive(target?: OfferTarget) {
    const offers = await this.getActiveOffersUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      target: target as CommerceOfferTarget | undefined,
    });
    return offers.map(mapOffer);
  }

  async create(data: CreateOfferDto) {
    try {
      const created = await this.createOfferUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        scope: data.scope,
        target: data.target,
        categoryIds: data.categoryIds,
        serviceIds: data.serviceIds,
        productCategoryIds: data.productCategoryIds,
        productIds: data.productIds,
        startDate: data.startDate,
        endDate: data.endDate,
        active: data.active,
      });
      return mapOffer(created);
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        OFFER_SERVICE_CATEGORY_IDS_REQUIRED: () =>
          new BadRequestException('Selecciona al menos una categoría para esta oferta.'),
        OFFER_PRODUCT_CATEGORY_IDS_REQUIRED: () =>
          new BadRequestException('Selecciona al menos una categoría de productos para esta oferta.'),
        OFFER_PRODUCT_TARGET_INVALID_SERVICE_SCOPE: () =>
          new BadRequestException('Las ofertas de productos no pueden usar el alcance de servicios.'),
        OFFER_SERVICE_TARGET_INVALID_PRODUCT_SCOPE: () =>
          new BadRequestException('Las ofertas de servicios no pueden usar el alcance de productos.'),
        OFFER_SERVICE_IDS_REQUIRED: () =>
          new BadRequestException('Selecciona al menos un servicio para esta oferta.'),
        OFFER_PRODUCT_IDS_REQUIRED: () =>
          new BadRequestException('Selecciona al menos un producto para esta oferta.'),
        OFFER_INVALID_DATE_RANGE: () =>
          new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.'),
        OFFER_NOT_FOUND: () => new NotFoundException('Offer not found'),
      });
      throw error;
    }
  }

  async update(id: string, data: UpdateOfferDto) {
    try {
      const updated = await this.updateOfferUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        offerId: id,
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        scope: data.scope,
        target: data.target,
        categoryIds: data.categoryIds,
        serviceIds: data.serviceIds,
        productCategoryIds: data.productCategoryIds,
        productIds: data.productIds,
        startDate: data.startDate,
        endDate: data.endDate,
        active: data.active,
      });
      return mapOffer(updated);
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        OFFER_SERVICE_CATEGORY_IDS_REQUIRED: () =>
          new BadRequestException('Selecciona al menos una categoría para esta oferta.'),
        OFFER_PRODUCT_CATEGORY_IDS_REQUIRED: () =>
          new BadRequestException('Selecciona al menos una categoría de productos para esta oferta.'),
        OFFER_PRODUCT_TARGET_INVALID_SERVICE_SCOPE: () =>
          new BadRequestException('Las ofertas de productos no pueden usar el alcance de servicios.'),
        OFFER_SERVICE_TARGET_INVALID_PRODUCT_SCOPE: () =>
          new BadRequestException('Las ofertas de servicios no pueden usar el alcance de productos.'),
        OFFER_SERVICE_IDS_REQUIRED: () =>
          new BadRequestException('Selecciona al menos un servicio para esta oferta.'),
        OFFER_PRODUCT_IDS_REQUIRED: () =>
          new BadRequestException('Selecciona al menos un producto para esta oferta.'),
        OFFER_INVALID_DATE_RANGE: () =>
          new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.'),
        OFFER_NOT_FOUND: () => new NotFoundException('Offer not found'),
      });
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.removeOfferUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        offerId: id,
      });
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        OFFER_NOT_FOUND: () => new NotFoundException('Offer not found'),
      });
      throw error;
    }
  }
}
