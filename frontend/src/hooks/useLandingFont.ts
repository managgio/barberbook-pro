import { useEffect, useId, useState } from 'react';
import { DEFAULT_HEADING_FONT, type HeadingFont } from '@/lib/landingAppearance';

export function useLandingFont(font?: HeadingFont | null) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [loaded, setLoaded] = useState<{ url: string; family: string } | null>(null);
  const url = font?.url;
  useEffect(() => {
    if (!url || !url.startsWith('https://') || typeof FontFace === 'undefined' || !document.fonts) return;
    let disposed = false;
    const family = `ManaggioHeading${id}`;
    const face = new FontFace(family, `url(${JSON.stringify(url)})`, { display: 'swap', weight: '100 900' });
    void face.load().then(() => {
      if (disposed) return;
      document.fonts.add(face);
      setLoaded({ url, family });
    }).catch(() => { /* The standard font remains visible when media cannot load. */ });
    return () => { disposed = true; document.fonts.delete(face); };
  }, [id, url]);
  return url && loaded?.url === url ? `"${loaded.family}", ${DEFAULT_HEADING_FONT}` : undefined;
}
