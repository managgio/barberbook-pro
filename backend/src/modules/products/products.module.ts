import { Module } from '@nestjs/common';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [ImageKitModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
