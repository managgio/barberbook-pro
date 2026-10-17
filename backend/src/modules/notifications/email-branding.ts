import type { EngagementEmailAttachment } from '../../contexts/engagement/ports/outbound/email-transport-factory.port';
import type { EffectiveTenantConfig } from '../../tenancy/tenant-config.types';

const DEFAULT_PRIMARY = '#fcbc23';
const DARK_BACKGROUND = '#0f0f12';
const DARK_CARD_BACKGROUND = '#15151b';
const LIGHT_BACKGROUND = '#f2f4f7';
const LIGHT_CARD_BACKGROUND = '#ffffff';

type Rgb = { r: number; g: number; b: number };

export type TenantEmailBranding = {
  mode: 'dark' | 'light';
  primary: string;
  accentText: string;
  primaryForeground: string;
  background: string;
  cardBackground: string;
  headerBackground: string;
  panelBackground: string;
  borderColor: string;
  textColor: string;
  mutedTextColor: string;
  footerBackground: string;
  logo: {
    src: string;
    attachment?: EngagementEmailAttachment;
  } | null;
};

const normalizeHexColor = (value?: string | null) => {
  const raw = value?.trim().replace(/^#/, '') || '';
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return DEFAULT_PRIMARY;
  const expanded = raw.length === 3
    ? raw.split('').map((character) => `${character}${character}`).join('')
    : raw;
  return `#${expanded.toLowerCase()}`;
};

const hexToRgb = (value: string): Rgb => {
  const numeric = Number.parseInt(value.slice(1), 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

const rgbToHex = ({ r, g, b }: Rgb) => `#${[r, g, b]
  .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
  .join('')}`;

const mixHex = (foreground: string, background: string, foregroundWeight: number) => {
  const front = hexToRgb(foreground);
  const back = hexToRgb(background);
  const weight = Math.min(1, Math.max(0, foregroundWeight));
  return rgbToHex({
    r: (front.r * weight) + (back.r * (1 - weight)),
    g: (front.g * weight) + (back.g * (1 - weight)),
    b: (front.b * weight) + (back.b * (1 - weight)),
  });
};

const relativeLuminance = (value: string) => {
  const rgb = hexToRgb(value);
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
};

const contrastRatio = (first: string, second: string) => {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
};

const ensureTextContrast = (color: string, background: string, target: string) => {
  let candidate = color;
  for (let index = 0; index < 12 && contrastRatio(candidate, background) < 4.5; index += 1) {
    candidate = mixHex(target, candidate, 0.14);
  }
  return candidate;
};

const resolveForeground = (background: string) => (
  contrastRatio('#0b0b0e', background) >= contrastRatio('#ffffff', background)
    ? '#0b0b0e'
    : '#ffffff'
);

const parseHttpsUrl = (value?: string | null) => {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
};

const isUrlWithinEndpoint = (url: URL, endpointValue?: string | null) => {
  const endpoint = parseHttpsUrl(endpointValue);
  if (!endpoint || endpoint.origin !== url.origin) return false;
  const endpointPath = endpoint.pathname.replace(/\/+$/, '');
  return !endpointPath
    || url.pathname === endpointPath
    || url.pathname.startsWith(`${endpointPath}/`);
};

const resolveLogo = (config: EffectiveTenantConfig): TenantEmailBranding['logo'] => {
  const candidate = config.theme?.mode === 'light'
    ? config.branding?.logoLightUrl || config.branding?.logoUrl || config.branding?.logoDarkUrl
    : config.branding?.logoDarkUrl || config.branding?.logoUrl || config.branding?.logoLightUrl;
  const logoUrl = parseHttpsUrl(candidate);
  if (!logoUrl) return null;

  if (!isUrlWithinEndpoint(logoUrl, config.imagekit?.urlEndpoint)) {
    return { src: logoUrl.toString() };
  }

  const cid = 'tenant-brand-logo';
  const attachmentUrl = new URL(logoUrl);
  attachmentUrl.searchParams.set('tr', 'w-160,f-png,q-90');
  return {
    src: `cid:${cid}`,
    attachment: {
      filename: 'tenant-brand-logo.png',
      path: attachmentUrl.toString(),
      contentType: 'image/png',
      cid,
    },
  };
};

export const resolveTenantEmailBranding = (
  config: EffectiveTenantConfig,
): TenantEmailBranding => {
  const mode = config.theme?.mode === 'light' ? 'light' : 'dark';
  const primary = normalizeHexColor(config.theme?.primary);
  const isLight = mode === 'light';
  const background = isLight ? LIGHT_BACKGROUND : DARK_BACKGROUND;
  const cardBackground = isLight ? LIGHT_CARD_BACKGROUND : DARK_CARD_BACKGROUND;
  const textColor = isLight ? '#18212b' : '#f8fafc';
  const mutedTextColor = isLight ? '#5c6774' : '#b4b7c0';
  return {
    mode,
    primary,
    accentText: ensureTextContrast(primary, cardBackground, isLight ? '#111827' : '#ffffff'),
    primaryForeground: resolveForeground(primary),
    background,
    cardBackground,
    headerBackground: mixHex(primary, cardBackground, isLight ? 0.1 : 0.2),
    panelBackground: mixHex(primary, cardBackground, isLight ? 0.06 : 0.12),
    borderColor: mixHex(primary, cardBackground, isLight ? 0.28 : 0.48),
    textColor,
    mutedTextColor,
    footerBackground: isLight ? '#f7f8fa' : '#0d0d10',
    logo: resolveLogo(config),
  };
};

export const escapeEmailHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const renderBrandedEmail = (params: {
  branding: TenantEmailBranding;
  brandName: string;
  eyebrow: string;
  bodyHtml: string;
  footerText: string;
}) => {
  const safeBrandName = escapeEmailHtml(params.brandName);
  const safeEyebrow = escapeEmailHtml(params.eyebrow);
  const safeFooterText = escapeEmailHtml(params.footerText);
  const logoHtml = params.branding.logo
    ? `<td width="72" valign="middle" style="width:72px; padding:0 16px 0 0;">
        <img src="${escapeEmailHtml(params.branding.logo.src)}" alt="${safeBrandName}" width="56" style="display:block; width:56px; height:auto; max-height:56px; border:0; outline:none; text-decoration:none;" />
      </td>`
    : '';

  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="${params.branding.mode}" />
        <meta name="supported-color-schemes" content="${params.branding.mode}" />
        <style>
          :root { color-scheme: ${params.branding.mode}; supported-color-schemes: ${params.branding.mode}; }
          @media only screen and (max-width: 680px) {
            .email-shell { padding: 12px 8px !important; }
            .email-card { border-radius: 12px !important; }
            .email-header, .email-body, .email-footer { padding-left: 18px !important; padding-right: 18px !important; }
          }
        </style>
      </head>
      <body bgcolor="${params.branding.background}" style="margin:0; padding:0; background:${params.branding.background}; color:${params.branding.textColor}; -webkit-text-size-adjust:100%;">
        <div class="email-shell" style="font-family:Inter, Arial, Helvetica, sans-serif; background:${params.branding.background}; padding:24px 12px; color:${params.branding.textColor};">
          <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:640px; margin:0 auto; background:${params.branding.cardBackground}; border:1px solid ${params.branding.borderColor}; border-radius:16px; border-collapse:separate; overflow:hidden; box-shadow:0 12px 32px rgba(0,0,0,0.10);">
            <tr>
              <td class="email-header" bgcolor="${params.branding.headerBackground}" style="padding:20px 24px; background:${params.branding.headerBackground}; border-top:4px solid ${params.branding.primary}; border-bottom:1px solid ${params.branding.borderColor};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${logoHtml}
                    <td valign="middle" style="text-align:left;">
                      <div style="font-weight:700; font-size:20px; line-height:1.25; color:${params.branding.textColor};">${safeBrandName}</div>
                      <div style="margin-top:4px; font-size:12px; line-height:1.4; color:${params.branding.mutedTextColor}; text-transform:uppercase; letter-spacing:0.08em;">${safeEyebrow}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-body" style="padding:24px; color:${params.branding.textColor};">${params.bodyHtml}</td>
            </tr>
            <tr>
              <td class="email-footer" bgcolor="${params.branding.footerBackground}" style="padding:16px 24px; background:${params.branding.footerBackground}; color:${params.branding.mutedTextColor}; font-size:12px; line-height:1.5; text-align:center; border-top:1px solid ${params.branding.borderColor};">
                ${safeFooterText}
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>`;
};

export const getTenantEmailLogoAttachments = (branding: TenantEmailBranding) => (
  branding.logo?.attachment ? [branding.logo.attachment] : []
);
