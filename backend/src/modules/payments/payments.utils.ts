import { Request } from 'express';

export const buildBaseUrl = (req: Request) => {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined) || req.protocol;
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  const protocol = forwardedProto?.split(',')[0]?.trim() || 'http';
  const host = forwardedHost?.split(',')[0]?.trim() || 'localhost';
  return `${protocol}://${host}`;
};
