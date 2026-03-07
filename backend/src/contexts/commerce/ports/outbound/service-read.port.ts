import { CommerceServiceReadModel } from '../../domain/entities/service-read.entity';

export const COMMERCE_SERVICE_READ_PORT = Symbol('COMMERCE_SERVICE_READ_PORT');

export interface CommerceServiceReadPort {
  listServices(params: { localId: string; includeArchived: boolean }): Promise<CommerceServiceReadModel[]>;
  getServiceById(params: {
    localId: string;
    serviceId: string;
    includeArchived: boolean;
  }): Promise<CommerceServiceReadModel | null>;
}
