import { Injectable } from '@nestjs/common';
import { AlertType } from '@prisma/client';
import { AiAlertToolPort } from '../../../contexts/ai-orchestration/ports/outbound/ai-alert-tool.port';
import { AlertsService } from '../../alerts/alerts.service';

@Injectable()
export class ModuleAiAlertToolAdapter implements AiAlertToolPort {
  constructor(private readonly alertsService: AlertsService) {}

  async createAlert(data: {
    title: string;
    message: string;
    type: AlertType;
    active: boolean;
    startDate?: string;
    endDate?: string;
  }) {
    const created = await this.alertsService.create(data);
    return {
      id: created.id,
      title: created.title,
      message: created.message,
      type: created.type as AlertType,
    };
  }
}
