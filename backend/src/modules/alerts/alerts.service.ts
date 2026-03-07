import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAlertUseCase } from '../../contexts/engagement/application/use-cases/create-alert.use-case';
import { GetAlertsUseCase } from '../../contexts/engagement/application/use-cases/get-alerts.use-case';
import { RemoveAlertUseCase } from '../../contexts/engagement/application/use-cases/remove-alert.use-case';
import { UpdateAlertUseCase } from '../../contexts/engagement/application/use-cases/update-alert.use-case';
import {
  AlertRepositoryPort,
  ENGAGEMENT_ALERT_REPOSITORY_PORT,
} from '../../contexts/engagement/ports/outbound/alert-repository.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { mapAlert } from './alerts.mapper';

@Injectable()
export class AlertsService {
  private readonly getAlertsUseCase: GetAlertsUseCase;
  private readonly createAlertUseCase: CreateAlertUseCase;
  private readonly updateAlertUseCase: UpdateAlertUseCase;
  private readonly removeAlertUseCase: RemoveAlertUseCase;

  constructor(
    @Inject(ENGAGEMENT_ALERT_REPOSITORY_PORT)
    private readonly alertRepositoryPort: AlertRepositoryPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.getAlertsUseCase = new GetAlertsUseCase(this.alertRepositoryPort);
    this.createAlertUseCase = new CreateAlertUseCase(this.alertRepositoryPort);
    this.updateAlertUseCase = new UpdateAlertUseCase(this.alertRepositoryPort);
    this.removeAlertUseCase = new RemoveAlertUseCase(this.alertRepositoryPort);
  }

  async findAll() {
    const alerts = await this.getAlertsUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      onlyActive: false,
    });
    return alerts.map(mapAlert);
  }

  async findActive() {
    const alerts = await this.getAlertsUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      onlyActive: true,
    });
    return alerts.map(mapAlert);
  }

  async create(data: CreateAlertDto) {
    try {
      const created = await this.createAlertUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        title: data.title,
        message: data.message,
        active: data.active,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      return mapAlert(created);
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async update(id: string, data: UpdateAlertDto) {
    try {
      const updated = await this.updateAlertUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        alertId: id,
        title: data.title,
        message: data.message,
        active: data.active,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      return mapAlert(updated);
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.removeAlertUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        alertId: id,
      });
      return { success: true };
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  private rethrowHttpError(error: unknown): never | void {
    rethrowDomainErrorAsHttp(error, {
      ALERT_NOT_FOUND: () => new NotFoundException('Alert not found'),
      ALERT_INVALID_DATE_RANGE: () =>
        new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.'),
      ALERT_INVALID_DATE: () =>
        new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.'),
    });
  }
}
