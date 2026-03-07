import { Injectable, Logger } from '@nestjs/common';
import { CommerceProductMediaStoragePort } from '../../../contexts/commerce/ports/outbound/product-media-storage.port';
import { ImageKitService } from '../../imagekit/imagekit.service';

@Injectable()
export class ModuleCommerceProductMediaStorageAdapter implements CommerceProductMediaStoragePort {
  private readonly logger = new Logger(ModuleCommerceProductMediaStorageAdapter.name);

  constructor(private readonly imageKitService: ImageKitService) {}

  async deleteImageFile(params: { productId: string; fileId: string }): Promise<void> {
    try {
      await this.imageKitService.deleteFile(params.fileId);
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar la imagen del producto ${params.productId} en ImageKit: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
