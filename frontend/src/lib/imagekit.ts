const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export type ImageKitAuth = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
  folder: string;
};

export const requestImageKitAuth = async (): Promise<ImageKitAuth> => {
  const response = await fetch(`${API_BASE}/imagekit/sign`);
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
  folder?: string
): Promise<{ url: string; fileId: string }> => {
  const auth = await requestImageKitAuth();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', fileName);
  formData.append('token', auth.token);
  formData.append('expire', String(auth.expire));
  formData.append('signature', auth.signature);
  formData.append('publicKey', auth.publicKey);
  formData.append('useUniqueFileName', 'true');
  const targetFolder = folder || auth.folder;
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

export const deleteFromImageKit = async (fileId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/imagekit/file/${fileId}`, { method: 'DELETE' });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'No se pudo eliminar la imagen.');
  }
};
