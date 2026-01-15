import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [TenancyModule],
  providers: [FirebaseAdminService],
  exports: [FirebaseAdminService],
})
export class FirebaseModule {}
