import { Module } from '@nestjs/common';
import { PrismaServiceCategoryRepositoryAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-service-category-repository.adapter';
import { COMMERCE_SERVICE_CATEGORY_REPOSITORY_PORT } from '../../contexts/commerce/ports/outbound/service-category-repository.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ServiceCategoriesService } from './service-categories.service';
import { ServiceCategoriesController } from './service-categories.controller';

@Module({
  imports: [TenancyModule],
  controllers: [ServiceCategoriesController],
  providers: [
    ServiceCategoriesService,
    PrismaServiceCategoryRepositoryAdapter,
    {
      provide: COMMERCE_SERVICE_CATEGORY_REPOSITORY_PORT,
      useExisting: PrismaServiceCategoryRepositoryAdapter,
    },
  ],
  exports: [ServiceCategoriesService],
})
export class ServiceCategoriesModule {}
