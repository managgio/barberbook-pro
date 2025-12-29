import { Module } from '@nestjs/common';
import { ImageKitService } from './imagekit.service';
import { ImageKitController } from './imagekit.controller';

@Module({
  controllers: [ImageKitController],
  providers: [ImageKitService],
})
export class ImageKitModule {}
