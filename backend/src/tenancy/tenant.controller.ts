import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from './tenant-config.service';
import { getCurrentBrandId, getCurrentLocalId, isPlatformRequest } from './tenant.context';

type SiteBrandingSettings = {
  branding?: {
    name?: string;
    tagline?: string;
    description?: string;
  };
};

const PLATFORM_TITLE = 'Managgio | Plataforma';
const PLATFORM_DESCRIPTION = 'Panel de plataforma para gestionar marcas, locales y credenciales en Managgio.';
const DEFAULT_TENANT_DESCRIPTION = 'Gestión de citas y servicios con Managgio.';
const DEFAULT_IMAGE_PATH = '/managgio-logo.webp';
const PREVIEW_BOT_REDIRECT_LABEL = 'Abriendo Managgio...';

const resolveText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) return normalized;
    }
  }
  return '';
};

const readHeader = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();

const normalizeHost = (value?: string) => value?.split(':')[0]?.trim().toLowerCase() || '';

const resolveHostFromUnknown = (value?: string) => {
  if (!value) return '';
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return normalizeHost(value);
  }
};

const resolveOrigin = (req: Request, hostOverride?: string) => {
  const host = resolveText(
    resolveHostFromUnknown(hostOverride),
    resolveHostFromUnknown(readHeader(req.headers['x-forwarded-host'])),
    resolveHostFromUnknown(readHeader(req.headers.host)),
    'localhost',
  );
  const protocol = resolveText(readHeader(req.headers['x-forwarded-proto']), req.protocol || 'https');
  return `${protocol}://${host}`;
};

const normalizePath = (rawPath?: string) => {
  const clean = rawPath?.trim();
  if (!clean || clean === '/') return '/';
  if (/^https?:\/\//i.test(clean)) {
    try {
      const parsed = new URL(clean);
      return parsed.pathname || '/';
    } catch {
      return '/';
    }
  }
  return clean.startsWith('/') ? clean : `/${clean}`;
};

const buildSearchFromQuery = (query: Request['query']) => {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (key === 'path' || key === 'tenantHost' || key === 'tenantSubdomain' || key === 'debug' || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        search.append(key, String(entry));
      });
      return;
    }
    search.append(key, String(value));
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
};

const resolveAbsoluteUrl = (origin: string, source: string) => {
  if (/^https?:\/\//i.test(source) || source.startsWith('data:')) return source;
  return new URL(source, origin).toString();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildPreviewHtml = (payload: {
  title: string;
  description: string;
  imageUrl: string;
  pageUrl: string;
  author: string;
  withRedirect: boolean;
  debugInfo?: Record<string, string>;
}) => {
  const title = escapeHtml(payload.title);
  const description = escapeHtml(payload.description);
  const imageUrl = escapeHtml(payload.imageUrl);
  const pageUrl = escapeHtml(payload.pageUrl);
  const author = escapeHtml(payload.author);
  const redirectScriptTarget = JSON.stringify(payload.pageUrl);

  const redirectMeta = payload.withRedirect ? `    <meta http-equiv="refresh" content="0;url=${pageUrl}" />` : '';
  const redirectScript = payload.withRedirect
    ? `    <script>window.location.replace(${redirectScriptTarget});</script>`
    : '';
  const redirectBody = payload.withRedirect ? `    <p>${escapeHtml(PREVIEW_BOT_REDIRECT_LABEL)}</p>` : '';
  const debugBody = payload.debugInfo
    ? `    <main style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:16px;line-height:1.45;">
      <h1 style="font-size:16px;margin:0 0 12px;">Tenant Preview Debug</h1>
      ${Object.entries(payload.debugInfo)
        .map(
          ([key, value]) =>
            `<div style="margin:6px 0;"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</div>`,
        )
        .join('')}
    </main>`
    : '';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="author" content="${author}" />
    <link rel="icon" href="${imageUrl}" />
    <link rel="apple-touch-icon" href="${imageUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
${redirectMeta}
  </head>
  <body>
${redirectBody}
${redirectScript}
${debugBody}
  </body>
</html>`;
};

@Controller('tenant')
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  @Get('bootstrap')
  async getBootstrap() {
    const brandId = getCurrentBrandId();
    const localId = getCurrentLocalId();
    const [brand, publicConfig] = await Promise.all([
      this.prisma.brand.findUnique({
        where: { id: brandId },
        include: {
          locations: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, slug: true, isActive: true },
          },
        },
      }),
      this.tenantConfig.getPublicConfig(),
    ]);

    return {
      brand: brand
        ? {
            id: brand.id,
            name: brand.name,
            subdomain: brand.subdomain,
            customDomain: brand.customDomain,
            defaultLocationId: brand.defaultLocationId,
          }
        : null,
      locations: brand?.locations || [],
      currentLocalId: localId,
      isPlatform: isPlatformRequest(),
      config: publicConfig,
    };
  }

  @Get('preview')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store, max-age=0')
  async getPreviewMeta(
    @Req() req: Request,
    @Query('path') requestedPath?: string,
    @Query('tenantHost') tenantHost?: string,
    @Query('debug') debug?: string,
  ) {
    const brandId = getCurrentBrandId();
    const localId = getCurrentLocalId();
    const isPlatform = isPlatformRequest();
    const origin = resolveOrigin(req, tenantHost);

    const [brand, publicConfig, siteSettings] = await Promise.all([
      this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      }),
      this.tenantConfig.getPublicConfig(),
      isPlatform
        ? Promise.resolve(null)
        : this.prisma.siteSettings.findUnique({
            where: { localId },
            select: { data: true },
          }),
    ]);

    const branding = (siteSettings?.data as SiteBrandingSettings | undefined)?.branding;
    const tenantName = resolveText(branding?.name, publicConfig.branding?.name, brand?.name, 'Managgio');
    const tagline = resolveText(branding?.tagline);
    const description = isPlatform
      ? PLATFORM_DESCRIPTION
      : resolveText(
          branding?.description,
          tagline,
          `${tenantName} · ${DEFAULT_TENANT_DESCRIPTION}`,
        );
    const imageSource = isPlatform
      ? DEFAULT_IMAGE_PATH
      : resolveText(
          publicConfig.branding?.logoUrl,
          publicConfig.branding?.logoLightUrl,
          publicConfig.branding?.logoDarkUrl,
          DEFAULT_IMAGE_PATH,
        );
    const title = isPlatform
      ? PLATFORM_TITLE
      : tagline
        ? `${tenantName} | ${tagline}`
        : tenantName;
    const pagePath = normalizePath(requestedPath);
    const pageQuery = buildSearchFromQuery(req.query);
    const pageUrl = new URL(`${pagePath}${pageQuery}`, origin).toString();
    const imageUrl = resolveAbsoluteUrl(origin, imageSource);
    const debugEnabled = ['1', 'true', 'yes'].includes((debug || '').trim().toLowerCase());

    return buildPreviewHtml({
      title,
      description,
      imageUrl,
      pageUrl,
      author: isPlatform ? 'Managgio' : tenantName,
      withRedirect: !debugEnabled,
      debugInfo: debugEnabled
        ? {
            isPlatform: String(isPlatform),
            brandId,
            localId,
            tenantHost: tenantHost || '',
            logoUrl: publicConfig.branding?.logoUrl || '',
            logoLightUrl: publicConfig.branding?.logoLightUrl || '',
            logoDarkUrl: publicConfig.branding?.logoDarkUrl || '',
            title,
            description,
            imageUrl,
            pageUrl,
          }
        : undefined,
    });
  }
}
