import { Request } from 'express';
import { TENANT_TRUST_X_FORWARDED_HOST } from '../../tenancy/tenant.constants';

export const buildBaseUrl = (req: Request) => {
  const forwardedProto = TENANT_TRUST_X_FORWARDED_HOST
    ? (req.headers['x-forwarded-proto'] as string | undefined) || req.protocol
    : req.protocol;
  const forwardedHost = TENANT_TRUST_X_FORWARDED_HOST
    ? (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host
    : req.headers.host;
  const protocol = forwardedProto?.split(',')[0]?.trim() || 'http';
  const host = forwardedHost?.split(',')[0]?.trim() || 'localhost';
  return `${protocol}://${host}`;
};
