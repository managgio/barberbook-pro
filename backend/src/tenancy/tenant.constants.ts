export const DEFAULT_BRAND_ID = process.env.DEFAULT_BRAND_ID || 'brand-leblond';
export const DEFAULT_LOCAL_ID = process.env.DEFAULT_LOCAL_ID || 'local-leblond';
export const DEFAULT_BRAND_SUBDOMAIN = process.env.DEFAULT_BRAND_SUBDOMAIN || 'leblond';
export const TENANT_BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN || 'managgio.com';
export const PLATFORM_SUBDOMAIN = process.env.PLATFORM_SUBDOMAIN || 'platform';
const isTruthy = (value?: string) => ['true', '1', 'yes'].includes((value || '').toLowerCase());
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const requireSubdomainRaw = process.env.TENANT_REQUIRE_SUBDOMAIN || '';
export const TENANT_REQUIRE_SUBDOMAIN = ['true', '1', 'yes'].includes(requireSubdomainRaw.toLowerCase());
const allowHeaderOverridesRaw = process.env.TENANT_ALLOW_HEADER_OVERRIDES;
export const TENANT_ALLOW_HEADER_OVERRIDES =
  allowHeaderOverridesRaw === undefined ? !isProduction : isTruthy(allowHeaderOverridesRaw);
const trustForwardedHostRaw = process.env.TENANT_TRUST_X_FORWARDED_HOST;
export const TENANT_TRUST_X_FORWARDED_HOST =
  trustForwardedHostRaw === undefined ? !isProduction : isTruthy(trustForwardedHostRaw);

const platformAdminRaw = process.env.PLATFORM_ADMIN_EMAILS || '';
export const PLATFORM_ADMIN_EMAILS = platformAdminRaw
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
