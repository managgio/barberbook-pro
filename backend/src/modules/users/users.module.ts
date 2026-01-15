import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TenancyModule, FirebaseModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
