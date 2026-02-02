import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseModule } from '../modules/firebase/firebase.module';
import { AuthService } from './auth.service';

@Module({
  imports: [PrismaModule, FirebaseModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
