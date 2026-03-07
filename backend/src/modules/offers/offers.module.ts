import { Module } from '@nestjs/common';
import { PrismaOfferManagementAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-offer-management.adapter';
import { COMMERCE_OFFER_MANAGEMENT_PORT } from '../../contexts/commerce/ports/outbound/offer-management.port';
import { PrismaOfferReadAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-offer-read.adapter';
import { COMMERCE_OFFER_READ_PORT } from '../../contexts/commerce/ports/outbound/offer-read.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';

@Module({
  imports: [TenancyModule],
  controllers: [OffersController],
  providers: [
    OffersService,
    PrismaOfferManagementAdapter,
    PrismaOfferReadAdapter,
    {
      provide: COMMERCE_OFFER_MANAGEMENT_PORT,
      useExisting: PrismaOfferManagementAdapter,
    },
    {
      provide: COMMERCE_OFFER_READ_PORT,
      useExisting: PrismaOfferReadAdapter,
    },
  ],
  exports: [OffersService],
})
export class OffersModule {}
