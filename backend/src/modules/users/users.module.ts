import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuthModule } from '../../auth/auth.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TenancyModule, FirebaseModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
