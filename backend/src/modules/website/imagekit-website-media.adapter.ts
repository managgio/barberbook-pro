import { Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { canonicalImagekitMediaUrl } from '../imagekit/imagekit-media-url';

@Injectable()
export class ImagekitWebsiteMediaAdapter {
  constructor(private readonly config: TenantConfigService) {}

  async resolve(brandId: string, localId: string | null, fileId: string) {
    const { imagekit } = await this.config.getBrandConfig(brandId);
    if (!imagekit?.privateKey || !imagekit.urlEndpoint) throw new DomainError('Media unavailable.', 'WEBSITE_MEDIA_UNAVAILABLE');
    const data = await this.details(imagekit.privateKey, fileId);
    const url = canonicalImagekitMediaUrl(data.url, imagekit.urlEndpoint);
    const path = String(data.filePath ?? '');
    const width = Number(data.width), height = Number(data.height), size = Number(data.size);
    if (data.fileId !== fileId || data.fileType !== 'image' || !path.includes(`/website/${brandId}/${localId ?? 'brand'}/`) ||
      !url || !/\.(webp|jpe?g|png)$/i.test(path) ||
      !Number.isInteger(width) || !Number.isInteger(height) || Math.min(width, height) < 160 || Math.max(width, height) > 2400 ||
      !Number.isFinite(size) || size <= 0 || size > 4 * 1024 * 1024) throw new DomainError('Invalid tenant media.', 'WEBSITE_INVALID_MEDIA');
    return { fileId, url: url.toString() };
  }

  private async details(privateKey: string, fileId: string): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
        headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}` }, signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 404) throw new DomainError('Invalid media.', 'WEBSITE_INVALID_MEDIA');
      if (!response.ok) throw new Error('provider');
      return await response.json() as Record<string, unknown>;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Media unavailable.', 'WEBSITE_MEDIA_UNAVAILABLE');
    }
  }

  async remove(brandId: string, fileId: string) {
    const { imagekit } = await this.config.getBrandConfig(brandId);
    if (!imagekit?.privateKey) throw new Error('WEBSITE_MEDIA_UNAVAILABLE');
    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE', headers: { Authorization: `Basic ${Buffer.from(`${imagekit.privateKey}:`).toString('base64')}` }, signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 404) throw new Error('WEBSITE_MEDIA_DELETE_FAILED');
  }
}
