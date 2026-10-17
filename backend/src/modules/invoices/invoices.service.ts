import { Inject, Injectable } from '@nestjs/common';
import { IssueAppointmentInvoiceUseCase } from '../../contexts/commerce/application/use-cases/issue-appointment-invoice.use-case';
import {
  COMMERCE_APPOINTMENT_INVOICE_PORT,
  CommerceAppointmentInvoicePort,
} from '../../contexts/commerce/ports/outbound/appointment-invoice.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';

@Injectable()
export class InvoicesService {
  private readonly issueAppointmentInvoiceUseCase: IssueAppointmentInvoiceUseCase;

  constructor(
    @Inject(COMMERCE_APPOINTMENT_INVOICE_PORT)
    invoicePort: CommerceAppointmentInvoicePort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.issueAppointmentInvoiceUseCase = new IssueAppointmentInvoiceUseCase(invoicePort);
  }

  issueForAppointment(appointmentId: string, actorUserId: string | null) {
    return this.issueAppointmentInvoiceUseCase.execute({
      context: this.tenantContextPort.getRequestContext({ actorUserId }),
      appointmentId,
      actorUserId,
    });
  }
}
