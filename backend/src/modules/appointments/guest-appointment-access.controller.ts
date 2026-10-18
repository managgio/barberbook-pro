import {
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CancelGuestAppointmentUseCase } from '../../contexts/booking/application/use-cases/cancel-guest-appointment.use-case';
import { GetGuestAppointmentAccessUseCase } from '../../contexts/booking/application/use-cases/get-guest-appointment-access.use-case';
import {
  GuestAppointmentAccessNotFoundError,
  GuestAppointmentAccessUnavailableError,
  GuestAppointmentCannotCancelError,
} from '../../contexts/booking/application/errors/guest-appointment-access.errors';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '../../contexts/platform/ports/outbound/tenant-context.port';

@Controller('appointments/guest-access')
export class GuestAppointmentAccessController {
  constructor(
    private readonly getGuestAppointmentAccessUseCase: GetGuestAppointmentAccessUseCase,
    private readonly cancelGuestAppointmentUseCase: CancelGuestAppointmentUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Referrer-Policy', 'no-referrer')
  getSummary(@Param('token') token: string) {
    return this.executeSafely(() => this.getGuestAppointmentAccessUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      token,
    }));
  }

  @Post(':token/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Referrer-Policy', 'no-referrer')
  cancel(@Param('token') token: string) {
    return this.executeSafely(() => this.cancelGuestAppointmentUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      token,
    }));
  }

  private async executeSafely<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof GuestAppointmentAccessUnavailableError) {
        throw new ServiceUnavailableException('La gestión de citas no está disponible temporalmente.');
      }
      if (error instanceof GuestAppointmentAccessNotFoundError) {
        throw new NotFoundException('No se ha encontrado una cita válida para este enlace.');
      }
      if (error instanceof GuestAppointmentCannotCancelError) {
        throw new ConflictException({
          message: 'Ya no es posible cancelar esta cita desde el enlace.',
          reason: error.reason,
        });
      }
      throw error;
    }
  }
}
