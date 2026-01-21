import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageKitService } from './imagekit.service';
import { ImageKitController } from './imagekit.controller';

@Module({
  imports: [TenancyModule, PrismaModule],
  controllers: [ImageKitController],
  providers: [ImageKitService],
})
export class ImageKitModule {}
