import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ImageKitService } from '@/modules/imagekit/imagekit.service';
import {
  PlatformMediaManagementPort,
  PlatformMediaUploadSignature,
} from '@/contexts/platform/ports/outbound/platform-media-management.port';

const baseSignature: PlatformMediaUploadSignature = {
  token: 'token',
  expire: 123,
  signature: 'signature',
  publicKey: 'public-key',
  urlEndpoint: 'https://ik.imagekit.io/tenant',
  folder: '/brand/folder',
};

const basePort = (): PlatformMediaManagementPort => ({
  signUpload: async () => baseSignature,
  deleteFile: async () => ({ success: true }),
  deleteFileForBrand: async () => ({ success: true }),
  deleteFilesForBrand: async () => ({ success: true, failures: [] }),
});

test('imagekit facade delegates signUpload', async () => {
  const calls: string[] = [];
  const service = new ImageKitService({
    ...basePort(),
    signUpload: async () => {
      calls.push('signUpload');
      return baseSignature;
    },
  });

  const result = await service.signUpload();

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'signUpload');
  assert.equal(result.publicKey, baseSignature.publicKey);
});

test('imagekit facade delegates deleteFile', async () => {
  const calls: string[] = [];
  const service = new ImageKitService({
    ...basePort(),
    deleteFile: async (fileId) => {
      calls.push(fileId);
      return { success: true };
    },
  });

  const result = await service.deleteFile('file-1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'file-1');
  assert.equal(result.success, true);
});

test('imagekit facade delegates deleteFileForBrand', async () => {
  const calls: Array<{ fileId: string; brandId: string }> = [];
  const service = new ImageKitService({
    ...basePort(),
    deleteFileForBrand: async (fileId, brandId) => {
      calls.push({ fileId, brandId });
      return { success: true };
    },
  });

  const result = await service.deleteFileForBrand('file-2', 'brand-1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].fileId, 'file-2');
  assert.equal(calls[0].brandId, 'brand-1');
  assert.equal(result.success, true);
});

test('imagekit facade delegates deleteFilesForBrand', async () => {
  const calls: Array<{ fileIds: string[]; brandId: string; continueOnError?: boolean }> = [];
  const service = new ImageKitService({
    ...basePort(),
    deleteFilesForBrand: async (fileIds, brandId, options) => {
      calls.push({ fileIds, brandId, continueOnError: options?.continueOnError });
      return { success: false, failures: [{ fileId: 'file-3', error: 'not found' }] };
    },
  });

  const result = await service.deleteFilesForBrand(['file-3'], 'brand-2', { continueOnError: true });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].brandId, 'brand-2');
  assert.equal(calls[0].continueOnError, true);
  assert.equal(result.success, false);
  assert.equal(result.failures.length, 1);
});
