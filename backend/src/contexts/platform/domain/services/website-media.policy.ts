import { DomainError } from '../../../../shared/domain/domain-error';

export type WebsiteConfig = {
  adminSidebar?: { hiddenSections?: string[]; visibleSections?: string[] };
  features?: { faqEnabled?: boolean; galleryEnabled?: boolean };
  branding?: Record<string, unknown>;
  landing?: { hiddenSections?: string[]; presentation?: { sections?: PresentationImage[] }; [key: string]: unknown };
  [key: string]: unknown;
};
type PresentationImage = { enabled?: boolean; title?: string; imageUrl?: string; imageFileId?: string; [key: string]: unknown };
export type WebsiteImage = { fileId: string; url: string };
export type WebsiteImageSection = { key: string; title?: string; kind: 'hero' | 'background' | 'presentation' | 'cta'; images: WebsiteImage[]; limit: number };
export const HERO_IMAGE_FIELDS = ['heroImage', 'heroImage2', 'heroImage3', 'heroImage4', 'heroImage5'] as const;
const LANDING_IMAGE_FIELDS = ['heroBackground', ...HERO_IMAGE_FIELDS, 'signImage'];
const image = (value: Record<string, unknown>, key: string): WebsiteImage[] => typeof value[`${key}Url`] === 'string' && value[`${key}Url`]
  ? [{ url: value[`${key}Url`] as string, fileId: typeof value[`${key}FileId`] === 'string' ? value[`${key}FileId`] as string : '' }] : [];

function mergeObjects(base: WebsiteConfig, override: WebsiteConfig): WebsiteConfig {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeObjects((base[key] ?? {}) as WebsiteConfig, value as WebsiteConfig) : value;
  }
  return result;
}

export function mergeWebsiteConfig(base: WebsiteConfig, override: WebsiteConfig): WebsiteConfig {
  const result = mergeObjects(base, override);
  // Capabilities are granted by Platform at brand scope.
  result.features = { ...result.features, faqEnabled: base.features?.faqEnabled === true, galleryEnabled: base.features?.galleryEnabled === true };
  return result;
}

export function isWebsiteEnabled(config: Pick<WebsiteConfig, 'adminSidebar'>) {
  return config.adminSidebar?.visibleSections?.includes('website') === true && !config.adminSidebar?.hiddenSections?.includes('website');
}

export function assertWebsiteEnabled(config: WebsiteConfig) {
  if (!isWebsiteEnabled(config)) throw new DomainError('Website management is disabled.', 'WEBSITE_DISABLED');
}

export function websiteImageSections(config: WebsiteConfig): WebsiteImageSection[] {
  const branding = config.branding ?? {};
  const hidden = config.landing?.hiddenSections ?? [];
  const result: WebsiteImageSection[] = [];
  if (branding.heroImageEnabled !== false) result.push({ key: 'hero', kind: 'hero', limit: 5, images: HERO_IMAGE_FIELDS.flatMap((key) => image(branding, key)) });
  result.push({ key: 'background', kind: 'background', limit: 1, images: image(branding, 'heroBackground') });
  if (!hidden.includes('presentation')) {
    for (let index = 0; index < 2; index++) {
      const section = config.landing?.presentation?.sections?.[index] ?? {};
      if (section.enabled ?? index === 0) result.push({ key: `presentation-${index}`, kind: 'presentation', title: section.title, limit: 1, images: image(section, 'image') });
    }
  }
  if (!hidden.includes('cta')) result.push({ key: 'cta', kind: 'cta', limit: 1, images: image(branding, 'signImage') });
  return result;
}

export function replaceWebsiteImages(local: WebsiteConfig, effective: WebsiteConfig, sectionKey: string, images: WebsiteImage[]): WebsiteConfig {
  assertWebsiteEnabled(effective);
  const section = websiteImageSections(effective).find((entry) => entry.key === sectionKey);
  if (!section) throw new DomainError('Section unavailable.', 'WEBSITE_SECTION_DISABLED');
  if (images.length > section.limit || images.some((entry) => !entry.url) || new Set(images.map((entry) => entry.url)).size !== images.length) {
    throw new DomainError('Invalid images.', 'WEBSITE_INVALID');
  }
  const next = structuredClone(local);
  if (section.kind === 'presentation') {
    const index = Number(sectionKey.slice(-1));
    const sections = structuredClone(effective.landing?.presentation?.sections ?? [{ enabled: true }, { enabled: false }]);
    sections[index] = { ...sections[index], imageUrl: images[0]?.url ?? '', imageFileId: images[0]?.fileId ?? '' };
    next.landing = { ...next.landing, presentation: { ...next.landing?.presentation, sections } };
  } else {
    const keys = section.kind === 'hero' ? HERO_IMAGE_FIELDS : [section.kind === 'background' ? 'heroBackground' : 'signImage'];
    next.branding = { ...next.branding };
    keys.forEach((key, index) => { next.branding![`${key}Url`] = images[index]?.url ?? ''; next.branding![`${key}FileId`] = images[index]?.fileId ?? ''; });
  }
  return next;
}

export function landingImageReferences(config: WebsiteConfig): WebsiteImage[] {
  const font = (config.theme as { headingFont?: WebsiteImage } | undefined)?.headingFont;
  return [...LANDING_IMAGE_FIELDS.flatMap((key) => image(config.branding ?? {}, key)),
    ...(config.landing?.presentation?.sections ?? []).flatMap((section) => image(section, 'image')),
    ...(font?.fileId && font.url ? [{ fileId: font.fileId, url: font.url }] : [])];
}
