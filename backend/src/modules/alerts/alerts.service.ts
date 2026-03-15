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
import { LocalizationService } from '../localization/localization.service';
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
    private readonly localizationService: LocalizationService,
  ) {
    this.getAlertsUseCase = new GetAlertsUseCase(this.alertRepositoryPort);
    this.createAlertUseCase = new CreateAlertUseCase(this.alertRepositoryPort);
    this.updateAlertUseCase = new UpdateAlertUseCase(this.alertRepositoryPort);
    this.removeAlertUseCase = new RemoveAlertUseCase(this.alertRepositoryPort);
  }

  async findAll() {
    const context = this.tenantContextPort.getRequestContext();
    const alerts = await this.getAlertsUseCase.execute({
      context,
      onlyActive: false,
    });
    const mapped = alerts.map(mapAlert);
    const { items } = await this.localizationService.localizeCollection({
      context,
      entityType: 'alert',
      items: mapped,
      descriptors: [
        {
          fieldKey: 'title',
          getValue: (item) => item.title,
          setValue: (item, value) => {
            item.title = value;
          },
        },
        {
          fieldKey: 'message',
          getValue: (item) => item.message,
          setValue: (item, value) => {
            item.message = value;
          },
        },
      ],
    });
    return items;
  }

  async findActive() {
    const context = this.tenantContextPort.getRequestContext();
    const alerts = await this.getAlertsUseCase.execute({
      context,
      onlyActive: true,
    });
    const mapped = alerts.map(mapAlert);
    const { items } = await this.localizationService.localizeCollection({
      context,
      entityType: 'alert',
      items: mapped,
      descriptors: [
        {
          fieldKey: 'title',
          getValue: (item) => item.title,
          setValue: (item, value) => {
            item.title = value;
          },
        },
        {
          fieldKey: 'message',
          getValue: (item) => item.message,
          setValue: (item, value) => {
            item.message = value;
          },
        },
      ],
    });
    return items;
  }

  async create(data: CreateAlertDto) {
    const context = this.tenantContextPort.getRequestContext();
    try {
      const created = await this.createAlertUseCase.execute({
        context,
        title: data.title,
        message: data.message,
        active: data.active,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      await this.localizationService.syncEntitySourceFields({
        context,
        entityType: 'alert',
        entityId: created.id,
        fields: {
          title: created.title,
          message: created.message,
        },
      });
      return mapAlert(created);
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async update(id: string, data: UpdateAlertDto) {
    const context = this.tenantContextPort.getRequestContext();
    try {
      const updated = await this.updateAlertUseCase.execute({
        context,
        alertId: id,
        title: data.title,
        message: data.message,
        active: data.active,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      await this.localizationService.syncEntitySourceFields({
        context,
        entityType: 'alert',
        entityId: updated.id,
        fields: {
          title: updated.title,
          message: updated.message,
        },
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
