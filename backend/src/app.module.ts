import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { TenantMiddleware } from './tenancy/tenant.middleware';
import { AdminGuard } from './auth/admin.guard';
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
import { SettingsModule } from './modules/settings/settings.module';
import { ServiceCategoriesModule } from './modules/service-categories/service-categories.module';
import { OffersModule } from './modules/offers/offers.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductCategoriesModule } from './modules/product-categories/product-categories.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { LegalModule } from './modules/legal/legal.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { ClientNotesModule } from './modules/client-notes/client-notes.module';
import { CashRegisterModule } from './modules/cash-register/cash-register.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TenancyModule,
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
    SettingsModule,
    ServiceCategoriesModule,
    OffersModule,
    ProductsModule,
    ProductCategoriesModule,
    AiAssistantModule,
    PlatformAdminModule,
    AuditLogsModule,
    LegalModule,
    ClientNotesModule,
    CashRegisterModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AdminGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
