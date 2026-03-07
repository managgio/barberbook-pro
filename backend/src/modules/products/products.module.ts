import { Module } from '@nestjs/common';
import { PrismaProductManagementAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-product-management.adapter';
import { COMMERCE_PRODUCT_MANAGEMENT_PORT } from '../../contexts/commerce/ports/outbound/product-management.port';
import { COMMERCE_PRODUCT_MEDIA_STORAGE_PORT } from '../../contexts/commerce/ports/outbound/product-media-storage.port';
import { PrismaProductReadAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-product-read.adapter';
import { COMMERCE_PRODUCT_READ_PORT } from '../../contexts/commerce/ports/outbound/product-read.port';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ModuleCommerceProductMediaStorageAdapter } from './adapters/module-commerce-product-media-storage.adapter';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [ImageKitModule, TenancyModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    PrismaProductManagementAdapter,
    PrismaProductReadAdapter,
    ModuleCommerceProductMediaStorageAdapter,
    {
      provide: COMMERCE_PRODUCT_MANAGEMENT_PORT,
      useExisting: PrismaProductManagementAdapter,
    },
    {
      provide: COMMERCE_PRODUCT_MEDIA_STORAGE_PORT,
      useExisting: ModuleCommerceProductMediaStorageAdapter,
    },
    {
      provide: COMMERCE_PRODUCT_READ_PORT,
      useExisting: PrismaProductReadAdapter,
    },
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
