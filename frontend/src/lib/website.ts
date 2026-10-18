import { TenantBootstrap } from '@/data/types';

export type WebsiteTab = 'images' | 'gallery' | 'faq';
export function websiteTabs(config: TenantBootstrap['config']): WebsiteTab[] {
  const hidden = config?.landing?.hiddenSections ?? [];
  return ['images', ...(config?.features?.galleryEnabled === true && !hidden.includes('gallery') ? ['gallery'] : []),
    ...(config?.features?.faqEnabled === true && !hidden.includes('faq') ? ['faq'] : [])] as WebsiteTab[];
}
