export type RequestContext = {
  tenantId: string;
  brandId: string;
  localId: string;
  isPlatform?: boolean;
  actorUserId: string | null;
  timezone: string;
  correlationId: string;
  subdomain?: string | null;
};
