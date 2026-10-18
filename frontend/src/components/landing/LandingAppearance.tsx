import type { CSSProperties, ReactNode } from 'react';
import { landingAppearanceStyle, validSecondaryColor, type LandingAppearance as Appearance } from '@/lib/landingAppearance';
import { useLandingFont } from '@/hooks/useLandingFont';
import './landing-appearance.css';

export default function LandingAppearance({ appearance, mode, children, className = '' }: {
  appearance?: Appearance | null; mode?: string; children: ReactNode; className?: string;
}) {
  const family = useLandingFont(appearance?.headingFont);
  return <div className={`landing-appearance ${className}`}
    data-heading-font={family ? '' : undefined}
    data-secondary={validSecondaryColor(appearance?.secondary) ? '' : undefined}
    style={{ ...landingAppearanceStyle(appearance?.secondary, mode), ...(family ? { '--landing-heading-font': family } : {}) } as CSSProperties}>
    {children}
  </div>;
}
