import { Injectable, Logger } from '@nestjs/common';
import { BarberPhotoStoragePort } from '../../../contexts/booking/ports/outbound/barber-photo-storage.port';
import { ImageKitService } from '../../imagekit/imagekit.service';

@Injectable()
export class ModuleBookingBarberPhotoStorageAdapter implements BarberPhotoStoragePort {
  private readonly logger = new Logger(ModuleBookingBarberPhotoStorageAdapter.name);

  constructor(private readonly imageKitService: ImageKitService) {}

  async deletePhotoFile(params: { barberId: string; fileId: string }): Promise<void> {
    try {
      await this.imageKitService.deleteFile(params.fileId);
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar la foto del barbero ${params.barberId} en ImageKit: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
