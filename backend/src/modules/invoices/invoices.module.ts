import { Module } from '@nestjs/common';
import { PrismaAppointmentInvoiceAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-appointment-invoice.adapter';
import { COMMERCE_APPOINTMENT_INVOICE_PORT } from '../../contexts/commerce/ports/outbound/appointment-invoice.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [TenancyModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    PrismaAppointmentInvoiceAdapter,
    {
      provide: COMMERCE_APPOINTMENT_INVOICE_PORT,
      useExisting: PrismaAppointmentInvoiceAdapter,
    },
  ],
})
export class InvoicesModule {}
