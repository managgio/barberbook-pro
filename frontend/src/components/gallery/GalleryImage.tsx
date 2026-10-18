import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { galleryImageSrcSet, galleryImageUrl } from '@/lib/galleryImages';
import { useI18n } from '@/hooks/useI18n';

export default function GalleryImage({ src, width, height, alt, className, sizes, eager = false }: {
  src: string; width: number; height: number; alt: string; className?: string; sizes: string; eager?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { t } = useI18n();
  if (failedSrc === src) return <div role="img" aria-label={t('gallery.imageUnavailable')} className={`${className ?? ''} flex items-center justify-center bg-muted`}><ImageOff className="h-7 w-7 text-muted-foreground" /></div>;
  return <img src={galleryImageUrl(src, Math.min(width, 720))} srcSet={galleryImageSrcSet(src, width)} sizes={sizes}
    width={width} height={height} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async"
    className={className} onError={() => setFailedSrc(src)} />;
}
