import {
  PlatformMediaDeleteFilesResult,
  PlatformMediaManagementPort,
  PlatformMediaUploadSignature,
} from '../../ports/outbound/platform-media-management.port';

export class ManagePlatformMediaUseCase {
  constructor(private readonly mediaManagementPort: PlatformMediaManagementPort) {}

  signUpload(): Promise<PlatformMediaUploadSignature> {
    return this.mediaManagementPort.signUpload();
  }

  deleteFile(fileId: string): Promise<{ success: true }> {
    return this.mediaManagementPort.deleteFile(fileId);
  }

  deleteFileForBrand(fileId: string, brandId: string): Promise<{ success: true }> {
    return this.mediaManagementPort.deleteFileForBrand(fileId, brandId);
  }

  deleteFilesForBrand(
    fileIds: string[],
    brandId: string,
    options: { continueOnError?: boolean } = {},
  ): Promise<PlatformMediaDeleteFilesResult> {
    return this.mediaManagementPort.deleteFilesForBrand(fileIds, brandId, options);
  }
}
