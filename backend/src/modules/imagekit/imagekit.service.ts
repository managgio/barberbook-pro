import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_BRAND_SUBDOMAIN } from '../../tenancy/tenant.constants';
import { getCurrentBrandId, getTenantContext } from '../../tenancy/tenant.context';

@Injectable()
export class ImageKitService {
  constructor(
    private readonly tenantConfig: TenantConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async signUpload() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const privateKey = config.imagekit?.privateKey;
    const publicKey = config.imagekit?.publicKey;
    const urlEndpoint = config.imagekit?.urlEndpoint;
    const folderPrefix = process.env.IMAGEKIT_FOLDER?.trim();
    const contextSubdomain = getTenantContext().subdomain;
    let brandSubdomain = contextSubdomain || null;
    if (!brandSubdomain) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: getCurrentBrandId() },
        select: { subdomain: true },
      });
      brandSubdomain = brand?.subdomain || DEFAULT_BRAND_SUBDOMAIN;
    }
    const normalizePart = (value?: string | null) => (value || '').replace(/^\/+|\/+$/g, '');
    const folderSuffix = normalizePart(config.imagekit?.folder?.trim());
    const normalizedSubdomain = normalizePart(brandSubdomain);
    const suffixHasSubdomain =
      Boolean(folderSuffix && normalizedSubdomain) &&
      (folderSuffix === normalizedSubdomain ||
        folderSuffix.startsWith(`${normalizedSubdomain}/`) ||
        folderSuffix.includes(`/${normalizedSubdomain}/`) ||
        folderSuffix.endsWith(`/${normalizedSubdomain}`));
    const parts = suffixHasSubdomain
      ? [folderSuffix]
      : [folderPrefix, brandSubdomain, folderSuffix].map(normalizePart).filter(Boolean);
    const folder = parts.length ? `/${parts.join('/')}` : undefined;

    if (!privateKey || !publicKey || !urlEndpoint) {
      throw new InternalServerErrorException('ImageKit no está configurado');
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expire = Math.floor(Date.now() / 1000) + 60 * 10;
    const signature = crypto.createHmac('sha1', privateKey).update(token + expire).digest('hex');

    return { token, expire, signature, publicKey, urlEndpoint, folder };
  }

  async deleteFile(fileId: string) {
    const config = await this.tenantConfig.getEffectiveConfig();
    const privateKey = config.imagekit?.privateKey;
    if (!privateKey) {
      throw new InternalServerErrorException('ImageKit no está configurado');
    }

    const response = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new InternalServerErrorException(
        `No se pudo eliminar la imagen en ImageKit: ${error || response.statusText}`,
      );
    }

    return { success: true };
  }
}
