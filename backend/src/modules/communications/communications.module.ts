import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunicationsController } from './communications.controller';
import { CommunicationsGuard } from './communications.guard';
import { CommunicationsSchedulerService } from './communications.scheduler';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    TenancyModule,
    NotificationsModule,
    AppointmentsModule,
    AuditLogsModule,
  ],
  controllers: [CommunicationsController],
  providers: [CommunicationsService, CommunicationsGuard, CommunicationsSchedulerService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
