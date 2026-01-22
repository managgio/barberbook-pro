import { Module } from '@nestjs/common';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { BarbersService } from './barbers.service';
import { BarbersController } from './barbers.controller';

@Module({
  imports: [ImageKitModule],
  controllers: [BarbersController],
  providers: [BarbersService],
  exports: [BarbersService],
})
export class BarbersModule {}
