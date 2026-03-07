import { Inject, Injectable } from '@nestjs/common';
import { ManagePlatformMediaUseCase } from '../../contexts/platform/application/use-cases/manage-platform-media.use-case';
import {
  PLATFORM_MEDIA_MANAGEMENT_PORT,
  PlatformMediaManagementPort,
} from '../../contexts/platform/ports/outbound/platform-media-management.port';

@Injectable()
export class ImageKitService {
  private readonly managePlatformMediaUseCase: ManagePlatformMediaUseCase;

  constructor(
    @Inject(PLATFORM_MEDIA_MANAGEMENT_PORT)
    private readonly mediaManagementPort: PlatformMediaManagementPort,
  ) {
    this.managePlatformMediaUseCase = new ManagePlatformMediaUseCase(this.mediaManagementPort);
  }

  async signUpload() {
    return this.managePlatformMediaUseCase.signUpload();
  }

  async deleteFile(fileId: string) {
    return this.managePlatformMediaUseCase.deleteFile(fileId);
  }

  async deleteFileForBrand(fileId: string, brandId: string) {
    return this.managePlatformMediaUseCase.deleteFileForBrand(fileId, brandId);
  }

  async deleteFilesForBrand(
    fileIds: string[],
    brandId: string,
    options: { continueOnError?: boolean } = {},
  ) {
    return this.managePlatformMediaUseCase.deleteFilesForBrand(fileIds, brandId, options);
  }
}
