import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { BarbersModule } from './modules/barbers/barbers.module';
import { ServicesModule } from './modules/services/services.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { RolesModule } from './modules/roles/roles.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { ImageKitModule } from './modules/imagekit/imagekit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    BarbersModule,
    ServicesModule,
    AppointmentsModule,
    AlertsModule,
    RolesModule,
    HolidaysModule,
    SchedulesModule,
    ImageKitModule,
    NotificationsModule,
  ],
})
export class AppModule {}
