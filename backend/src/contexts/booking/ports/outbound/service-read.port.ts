export const SERVICE_CATALOG_READ_PORT = Symbol('SERVICE_CATALOG_READ_PORT');

export interface ServiceCatalogReadPort {
  getServiceDuration(params: { localId: string; serviceId?: string }): Promise<number>;
}
