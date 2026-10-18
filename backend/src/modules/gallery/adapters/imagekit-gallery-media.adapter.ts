import { Injectable } from '@nestjs/common';
import { GalleryMediaPort } from '../../../contexts/engagement/ports/outbound/gallery-media.port';
import { RequestContext } from '../../../shared/application/request-context';
import { DomainError } from '../../../shared/domain/domain-error';
import { TenantConfigService } from '../../../tenancy/tenant-config.service';
import { canonicalImagekitMediaUrl } from '../../imagekit/imagekit-media-url';

@Injectable()
export class ImagekitGalleryMediaAdapter implements GalleryMediaPort {
  constructor(private readonly config: TenantConfigService) {}

  async resolve(context: RequestContext, fileId: string) {
    const { imagekit } = await this.config.getEffectiveConfig();
    if (!imagekit?.privateKey || !imagekit.urlEndpoint) throw new DomainError('Media unavailable.', 'GALLERY_MEDIA_UNAVAILABLE');
    let response: Response;
    try {
      response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
        headers: { Authorization: `Basic ${Buffer.from(`${imagekit.privateKey}:`).toString('base64')}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch { throw new DomainError('Media unavailable.', 'GALLERY_MEDIA_UNAVAILABLE'); }
    if (response.status === 404) throw new DomainError('Invalid media.', 'GALLERY_INVALID_MEDIA');
    if (!response.ok) throw new DomainError('Media unavailable.', 'GALLERY_MEDIA_UNAVAILABLE');
    let data: Record<string, unknown>;
    try { data = await response.json() as Record<string, unknown>; }
    catch { throw new DomainError('Media unavailable.', 'GALLERY_MEDIA_UNAVAILABLE'); }
    if (!data || typeof data !== 'object') throw new DomainError('Invalid media.', 'GALLERY_INVALID_MEDIA');
    const url = canonicalImagekitMediaUrl(data.url, imagekit.urlEndpoint);
    const path = String(data.filePath ?? '');
    const width = Number(data.width);
    const height = Number(data.height);
    const size = Number(data.size);
    // IDs and image metadata are resolved from ImageKit, never trusted from the request body.
    if (data.fileId !== fileId || data.fileType !== 'image' || !path.includes(`/gallery/${context.localId}/`) ||
      !url ||
      !/\.(webp|jpe?g|png)$/i.test(path) || !Number.isInteger(width) || !Number.isInteger(height) ||
      Math.min(width, height) < 160 || Math.max(width, height) > 2400 || !Number.isFinite(size) || size <= 0 || size > 4 * 1024 * 1024) {
      throw new DomainError('Invalid tenant media.', 'GALLERY_INVALID_MEDIA');
    }
    return { fileId, url: url.toString(), width, height };
  }
}
