import { normalizeHeadingFont, normalizeSecondaryColor } from '../../domain/services/landing-appearance.policy';
import { LandingFontMediaPort } from '../../ports/outbound/landing-font-media.port';

export class PrepareLandingAppearanceUseCase {
  constructor(private readonly media: LandingFontMediaPort) {}

  async execute(brandId: string, localId: string | null, incoming: Record<string, unknown>, previous: Record<string, unknown>) {
    if (!incoming.theme || typeof incoming.theme !== 'object' || Array.isArray(incoming.theme)) return incoming;
    const theme = { ...incoming.theme as Record<string, unknown> };
    if ('secondary' in theme) theme.secondary = normalizeSecondaryColor(theme.secondary);
    if ('headingFont' in theme) {
      const font = normalizeHeadingFont(theme.headingFont);
      const oldFont = (previous.theme as Record<string, unknown> | undefined)?.headingFont;
      theme.headingFont = font && JSON.stringify(font) !== JSON.stringify(oldFont)
        ? await this.media.resolveFont(brandId, localId, font) : font;
    }
    return { ...incoming, theme };
  }
}
