import { HeadingFont } from '../../domain/services/landing-appearance.policy';

export interface LandingFontMediaPort {
  resolveFont(brandId: string, localId: string | null, font: HeadingFont): Promise<HeadingFont>;
}
