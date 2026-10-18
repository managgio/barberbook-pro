import { ScanLine } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import type { WebsiteImageSection } from '@/data/api/website';

export default function WebsitePhotoGuidance({ kind }: { kind: WebsiteImageSection['kind'] }) {
  const { t } = useI18n();
  return <p className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
    <ScanLine aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
    <span><span className="font-medium text-foreground">{t('website.photoRecommendation')} </span>{t(`website.photoGuidance.${kind}`)}</span>
  </p>;
}
