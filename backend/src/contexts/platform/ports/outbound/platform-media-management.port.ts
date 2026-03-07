export const PLATFORM_MEDIA_MANAGEMENT_PORT = Symbol('PLATFORM_MEDIA_MANAGEMENT_PORT');

export type PlatformMediaUploadSignature = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
  folder?: string;
};

export type PlatformMediaDeleteFilesResult = {
  success: boolean;
  failures: Array<{ fileId: string; error: string }>;
};

export interface PlatformMediaManagementPort {
  signUpload(): Promise<PlatformMediaUploadSignature>;
  deleteFile(fileId: string): Promise<{ success: true }>;
  deleteFileForBrand(fileId: string, brandId: string): Promise<{ success: true }>;
  deleteFilesForBrand(
    fileIds: string[],
    brandId: string,
    options?: { continueOnError?: boolean },
  ): Promise<PlatformMediaDeleteFilesResult>;
}
