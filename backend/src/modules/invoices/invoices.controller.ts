import { Controller, Param, Post, Req } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@AdminEndpoint()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('appointments/:appointmentId')
  issueForAppointment(
    @Param('appointmentId') appointmentId: string,
    @Req() request: { adminUserId?: string },
  ) {
    return this.invoicesService.issueForAppointment(appointmentId, request.adminUserId || null);
  }
}
