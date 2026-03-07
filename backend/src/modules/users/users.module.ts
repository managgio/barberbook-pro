import { Module } from '@nestjs/common';
import { PrismaUserReadAdapter } from '../../contexts/identity/infrastructure/prisma/prisma-user-read.adapter';
import { PrismaUserWriteAdapter } from '../../contexts/identity/infrastructure/prisma/prisma-user-write.adapter';
import { IDENTITY_AUTH_USER_PORT } from '../../contexts/identity/ports/outbound/identity-auth-user.port';
import { IDENTITY_USER_READ_PORT } from '../../contexts/identity/ports/outbound/user-read.port';
import { IDENTITY_USER_WRITE_PORT } from '../../contexts/identity/ports/outbound/user-write.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuthModule } from '../../auth/auth.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { ModuleIdentityAuthUserAdapter } from './adapters/module-identity-auth-user.adapter';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TenancyModule, FirebaseModule, AuthModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    PrismaUserReadAdapter,
    PrismaUserWriteAdapter,
    ModuleIdentityAuthUserAdapter,
    {
      provide: IDENTITY_USER_READ_PORT,
      useExisting: PrismaUserReadAdapter,
    },
    {
      provide: IDENTITY_USER_WRITE_PORT,
      useExisting: PrismaUserWriteAdapter,
    },
    {
      provide: IDENTITY_AUTH_USER_PORT,
      useExisting: ModuleIdentityAuthUserAdapter,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
