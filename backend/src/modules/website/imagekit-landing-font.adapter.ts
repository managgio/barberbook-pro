import { Injectable } from '@nestjs/common';
import { HeadingFont, MAX_HEADING_FONT_BYTES, validateHeadingFontBytes } from '../../contexts/platform/domain/services/landing-appearance.policy';
import { LandingFontMediaPort } from '../../contexts/platform/ports/outbound/landing-font-media.port';
import { DomainError } from '../../shared/domain/domain-error';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { canonicalImagekitMediaUrl } from '../imagekit/imagekit-media-url';

@Injectable()
export class ImagekitLandingFontAdapter implements LandingFontMediaPort {
  constructor(private readonly config: TenantConfigService) {}

  async resolveFont(brandId: string, localId: string | null, font: HeadingFont): Promise<HeadingFont> {
    const invalid = () => new DomainError('Invalid tenant font.', 'LANDING_APPEARANCE_INVALID');
    try {
      const { imagekit } = await this.config.getBrandConfig(brandId);
      if (!imagekit?.privateKey || !imagekit.urlEndpoint) throw new Error('unavailable');
      const details = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(font.fileId)}/details`, {
        headers: { Authorization: `Basic ${Buffer.from(`${imagekit.privateKey}:`).toString('base64')}` }, signal: AbortSignal.timeout(10_000),
      });
      if (details.status === 404) throw invalid();
      if (!details.ok) throw new Error('provider');
      const data = await details.json() as Record<string, unknown>;
      const path = String(data.filePath ?? '');
      const url = canonicalImagekitMediaUrl(data.url, imagekit.urlEndpoint);
      if (data.fileId !== font.fileId || data.fileType !== 'non-image' || !url ||
        !path.includes(`/website/${brandId}/${localId ?? 'brand'}/fonts/`) || !path.toLowerCase().endsWith(`.${font.format}`) ||
        typeof data.size !== 'number' || data.size <= 0 || data.size > MAX_HEADING_FONT_BYTES) throw invalid();
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
      if (!response.ok || !response.body) throw new Error('download');
      const reader = response.body.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_HEADING_FONT_BYTES) throw invalid();
          parts.push(value);
        }
      } finally { await reader.cancel(); }
      if (size !== data.size) throw invalid();
      validateHeadingFontBytes(Buffer.concat(parts), font.format);
      return { ...font, url: url.toString() };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Font provider unavailable.', 'LANDING_FONT_UNAVAILABLE');
    }
  }
}
