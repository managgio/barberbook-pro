import { Module } from '@nestjs/common';
import { PrismaProductCategoryRepositoryAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-product-category-repository.adapter';
import { COMMERCE_PRODUCT_CATEGORY_REPOSITORY_PORT } from '../../contexts/commerce/ports/outbound/product-category-repository.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ProductCategoriesService } from './product-categories.service';
import { ProductCategoriesController } from './product-categories.controller';

@Module({
  imports: [TenancyModule],
  controllers: [ProductCategoriesController],
  providers: [
    ProductCategoriesService,
    PrismaProductCategoryRepositoryAdapter,
    {
      provide: COMMERCE_PRODUCT_CATEGORY_REPOSITORY_PORT,
      useExisting: PrismaProductCategoryRepositoryAdapter,
    },
  ],
  exports: [ProductCategoriesService],
})
export class ProductCategoriesModule {}
