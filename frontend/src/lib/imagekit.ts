import { getStoredLocalId, getTenantSubdomainOverride } from '@/lib/tenant';
import { getAdminUserId } from '@/lib/authStorage';

const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export type ImageKitRequestOptions = {
  subdomainOverride?: string;
  localIdOverride?: string;
  adminUserIdOverride?: string;
};

export type ImageKitAuth = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
  folder?: string;
};

export const requestImageKitAuth = async (options: ImageKitRequestOptions = {}): Promise<ImageKitAuth> => {
  const localId = options.localIdOverride ?? getStoredLocalId();
  const tenantOverride = options.subdomainOverride ?? getTenantSubdomainOverride();
  const adminUserId = options.adminUserIdOverride ?? getAdminUserId();
  const response = await fetch(`${API_BASE}/imagekit/sign`, {
    headers: {
      ...(localId ? { 'x-local-id': localId } : {}),
      ...(tenantOverride ? { 'x-tenant-subdomain': tenantOverride } : {}),
      ...(adminUserId ? { 'x-admin-user-id': adminUserId } : {}),
    },
  });
  if (!response.ok) {
    throw new Error('No se pudo obtener la firma de ImageKit.');
  }
  const data = await response.json();
  if (!data.publicKey || !data.urlEndpoint) {
    throw new Error('ImageKit no está configurado en el servidor.');
  }
  return {
    token: data.token,
    expire: data.expire,
    signature: data.signature,
    publicKey: data.publicKey,
    urlEndpoint: data.urlEndpoint,
    folder: data.folder,
  };
};

export const uploadToImageKit = async (
  file: Blob,
  fileName: string,
  folder?: string,
  options?: ImageKitRequestOptions
): Promise<{ url: string; fileId: string }> => {
  const auth = await requestImageKitAuth(options);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', fileName);
  formData.append('token', auth.token);
  formData.append('expire', String(auth.expire));
  formData.append('signature', auth.signature);
  formData.append('publicKey', auth.publicKey);
  formData.append('useUniqueFileName', 'true');
  const envPrefix = (import.meta.env.VITE_IMAGEKIT_FOLDER_PREFIX || '').trim();
  const normalizePart = (value?: string) => (value || '').trim().replace(/^\/+|\/+$/g, '');
  const resolveFolder = (baseFolder?: string, overrideFolder?: string) => {
    const normalizedOverride = overrideFolder?.trim();
    if (!normalizedOverride) return baseFolder;
    if (normalizedOverride.startsWith('/') || !baseFolder) {
      return normalizedOverride.startsWith('/') ? normalizedOverride : `/${normalizedOverride}`;
    }
    const normalizedBase = baseFolder.replace(/\/+$/, '');
    const normalizedChild = normalizedOverride.replace(/^\/+/, '');
    return `${normalizedBase}/${normalizedChild}`;
  };
  const applyPrefix = (value?: string) => {
    const normalizedPrefix = normalizePart(envPrefix);
    if (!normalizedPrefix) return value;
    const normalizedValue = normalizePart(value || '');
    if (!normalizedValue) return `/${normalizedPrefix}`;
    if (normalizedValue === normalizedPrefix || normalizedValue.startsWith(`${normalizedPrefix}/`)) {
      return `/${normalizedValue}`;
    }
    return `/${normalizedPrefix}/${normalizedValue}`;
  };
  const targetFolder = applyPrefix(resolveFolder(auth.folder, folder));
  if (targetFolder) {
    formData.append('folder', targetFolder);
  }

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al subir la imagen: ${errorText}`);
  }

  const result = await response.json();
  return { url: result.url as string, fileId: result.fileId as string };
};

export const deleteFromImageKit = async (fileId: string, options: ImageKitRequestOptions = {}): Promise<void> => {
  const localId = options.localIdOverride ?? getStoredLocalId();
  const tenantOverride = options.subdomainOverride ?? getTenantSubdomainOverride();
  const adminUserId = options.adminUserIdOverride ?? getAdminUserId();
  const response = await fetch(`${API_BASE}/imagekit/file/${fileId}`, {
    method: 'DELETE',
    headers: {
      ...(localId ? { 'x-local-id': localId } : {}),
      ...(tenantOverride ? { 'x-tenant-subdomain': tenantOverride } : {}),
      ...(adminUserId ? { 'x-admin-user-id': adminUserId } : {}),
    },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'No se pudo eliminar la imagen.');
  }
};
