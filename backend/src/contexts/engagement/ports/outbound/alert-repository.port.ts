import { AlertEntity } from '../../domain/entities/alert.entity';

export const ENGAGEMENT_ALERT_REPOSITORY_PORT = Symbol('ENGAGEMENT_ALERT_REPOSITORY_PORT');

export type CreateAlertInput = {
  localId: string;
  title: string;
  message: string;
  active: boolean;
  type: string;
  startDate: Date | null;
  endDate: Date | null;
};

export type UpdateAlertInput = {
  title?: string;
  message?: string;
  active?: boolean;
  type?: string;
  startDate?: Date | null;
  endDate?: Date | null;
};

export interface AlertRepositoryPort {
  listByLocalId(localId: string): Promise<AlertEntity[]>;
  listActiveByLocalId(params: { localId: string; now: Date }): Promise<AlertEntity[]>;
  create(input: CreateAlertInput): Promise<AlertEntity>;
  findByIdAndLocalId(params: { id: string; localId: string }): Promise<AlertEntity | null>;
  updateById(id: string, input: UpdateAlertInput): Promise<AlertEntity>;
  deleteById(id: string): Promise<void>;
}

