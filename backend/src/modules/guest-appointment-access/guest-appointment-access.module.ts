import { Module } from '@nestjs/common';
import { HmacGuestAppointmentAccessTokenAdapter } from '../../contexts/booking/infrastructure/adapters/hmac-guest-appointment-access-token.adapter';
import { BOOKING_GUEST_APPOINTMENT_ACCESS_TOKEN_PORT } from '../../contexts/booking/ports/outbound/guest-appointment-access-token.port';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { GuestAppointmentLinkService } from './guest-appointment-link.service';

@Module({
  imports: [PrismaModule, TenancyModule],
  providers: [
    {
      provide: BOOKING_GUEST_APPOINTMENT_ACCESS_TOKEN_PORT,
      useFactory: () => new HmacGuestAppointmentAccessTokenAdapter({
        secret: process.env.GUEST_APPOINTMENT_LINK_SECRET,
        production: (process.env.NODE_ENV || '').toLowerCase() === 'production',
      }),
    },
    GuestAppointmentLinkService,
  ],
  exports: [BOOKING_GUEST_APPOINTMENT_ACCESS_TOKEN_PORT, GuestAppointmentLinkService],
})
export class GuestAppointmentAccessModule {}
