import type { IssueAppointmentInvoiceCommand } from '../commands/issue-appointment-invoice.command';
import type { CommerceAppointmentInvoicePort } from '../../ports/outbound/appointment-invoice.port';

export class IssueAppointmentInvoiceUseCase {
  constructor(private readonly invoicePort: CommerceAppointmentInvoicePort) {}

  execute(command: IssueAppointmentInvoiceCommand) {
    return this.invoicePort.issueForAppointment({
      brandId: command.context.brandId,
      localId: command.context.localId,
      timezone: command.context.timezone,
      appointmentId: command.appointmentId,
      actorUserId: command.actorUserId,
    });
  }
}
