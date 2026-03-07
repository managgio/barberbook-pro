import { AlertType } from '@prisma/client';

export const AI_ALERT_TOOL_PORT = Symbol('AI_ALERT_TOOL_PORT');

export interface AiAlertToolPort {
  createAlert(data: {
    title: string;
    message: string;
    type: AlertType;
    active: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    id: string;
    title: string;
    message: string;
    type: AlertType;
  }>;
}
