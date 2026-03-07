export const TENANT_CONFIG_READ_PORT = Symbol('TENANT_CONFIG_READ_PORT');

export type TenantConfigBusiness = {
  type?: string | null;
};

export type TenantNotificationPrefs = {
  sms?: boolean;
  whatsapp?: boolean;
};

export type TenantFirebaseAdminConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

export type TenantEffectiveConfigReadModel = {
  business?: TenantConfigBusiness;
  notificationPrefs?: TenantNotificationPrefs;
};

export type TenantBrandConfigReadModel = {
  firebaseAdmin?: TenantFirebaseAdminConfig | null;
};

export interface TenantConfigReadPort {
  getEffectiveConfig(): Promise<TenantEffectiveConfigReadModel>;
  getBrandConfig(brandId: string): Promise<TenantBrandConfigReadModel>;
}
