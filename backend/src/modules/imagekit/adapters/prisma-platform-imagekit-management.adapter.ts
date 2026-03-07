import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PLATFORM_MEDIA_MANAGEMENT_PORT,
  PlatformMediaDeleteFilesResult,
  PlatformMediaManagementPort,
  PlatformMediaUploadSignature,
} from '../../../contexts/platform/ports/outbound/platform-media-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { DEFAULT_BRAND_SUBDOMAIN } from '../../../tenancy/tenant.constants';
import { TenantConfigService } from '../../../tenancy/tenant-config.service';

@Injectable()
export class PrismaPlatformImageKitManagementAdapter implements PlatformMediaManagementPort {
  constructor(
    private readonly tenantConfig: TenantConfigService,
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  async signUpload(): Promise<PlatformMediaUploadSignature> {
    const config = await this.tenantConfig.getEffectiveConfig();
    const privateKey = config.imagekit?.privateKey;
    const publicKey = config.imagekit?.publicKey;
    const urlEndpoint = config.imagekit?.urlEndpoint;
    const folderPrefix = process.env.IMAGEKIT_FOLDER?.trim();
    const tenantContext = this.tenantContextPort.getRequestContext();
    const contextSubdomain = tenantContext.subdomain || null;
    let brandSubdomain = contextSubdomain || null;
    if (!brandSubdomain) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: tenantContext.brandId },
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

  async deleteFile(fileId: string): Promise<{ success: true }> {
    const config = await this.tenantConfig.getEffectiveConfig();
    const privateKey = config.imagekit?.privateKey;
    if (!privateKey) {
      throw new InternalServerErrorException('ImageKit no está configurado');
    }

    await this.deleteWithPrivateKey(fileId, privateKey);

    return { success: true };
  }

  async deleteFileForBrand(fileId: string, brandId: string): Promise<{ success: true }> {
    const config = await this.tenantConfig.getBrandConfig(brandId);
    const privateKey = config.imagekit?.privateKey;
    if (!privateKey) {
      throw new InternalServerErrorException('ImageKit no está configurado');
    }

    await this.deleteWithPrivateKey(fileId, privateKey);
    return { success: true };
  }

  async deleteFilesForBrand(
    fileIds: string[],
    brandId: string,
    options: { continueOnError?: boolean } = {},
  ): Promise<PlatformMediaDeleteFilesResult> {
    const config = await this.tenantConfig.getBrandConfig(brandId);
    const privateKey = config.imagekit?.privateKey;
    if (!privateKey) {
      throw new InternalServerErrorException('ImageKit no está configurado');
    }

    const failures: Array<{ fileId: string; error: string }> = [];
    for (const fileId of fileIds) {
      try {
        await this.deleteWithPrivateKey(fileId, privateKey);
      } catch (error) {
        if (!options.continueOnError) {
          throw error;
        }
        failures.push({
          fileId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success: failures.length === 0, failures };
  }

  private async deleteWithPrivateKey(fileId: string, privateKey: string) {
    const response = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      const normalizedError = (error || '').toLowerCase();
      if (response.status === 404 || normalizedError.includes('does not exist')) {
        return;
      }
      throw new InternalServerErrorException(
        `No se pudo eliminar la imagen en ImageKit: ${error || response.statusText}`,
      );
    }
  }
}

export const PrismaPlatformImageKitManagementAdapterProvider = {
  provide: PLATFORM_MEDIA_MANAGEMENT_PORT,
  useExisting: PrismaPlatformImageKitManagementAdapter,
};
