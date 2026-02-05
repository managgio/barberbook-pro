import { Module } from '@nestjs/common';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { SettingsModule } from '../settings/settings.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { BarbersService } from './barbers.service';
import { BarbersController } from './barbers.controller';

@Module({
  imports: [ImageKitModule, SettingsModule, TenancyModule],
  controllers: [BarbersController],
  providers: [BarbersService],
  exports: [BarbersService],
})
export class BarbersModule {}
