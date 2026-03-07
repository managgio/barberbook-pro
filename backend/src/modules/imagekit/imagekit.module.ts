import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageKitService } from './imagekit.service';
import { ImageKitController } from './imagekit.controller';
import {
  PrismaPlatformImageKitManagementAdapter,
  PrismaPlatformImageKitManagementAdapterProvider,
} from './adapters/prisma-platform-imagekit-management.adapter';

@Module({
  imports: [TenancyModule, PrismaModule],
  controllers: [ImageKitController],
  providers: [
    PrismaPlatformImageKitManagementAdapter,
    PrismaPlatformImageKitManagementAdapterProvider,
    ImageKitService,
  ],
  exports: [ImageKitService],
})
export class ImageKitModule {}
