const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const DEFAULT_FOLDER = '/barbers';

const assertConfig = () => {
  const publicKey = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
  const urlEndpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;
  if (!publicKey || !urlEndpoint) {
    throw new Error('ImageKit no está configurado. Añade las variables de entorno.');
  }
  return { publicKey, urlEndpoint };
};

export type ImageKitAuth = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
};

export const requestImageKitAuth = async (): Promise<ImageKitAuth> => {
  const config = assertConfig();
  const response = await fetch('/api/imagekit/sign');
  if (!response.ok) {
    throw new Error('No se pudo obtener la firma de ImageKit.');
  }
  const data = await response.json();
  return {
    ...config,
    token: data.token,
    expire: data.expire,
    signature: data.signature,
    publicKey: data.publicKey || config.publicKey,
    urlEndpoint: data.urlEndpoint || config.urlEndpoint,
  };
};

export const uploadToImageKit = async (
  file: Blob,
  fileName: string,
  folder: string = DEFAULT_FOLDER
): Promise<string> => {
  const auth = await requestImageKitAuth();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', fileName);
  formData.append('token', auth.token);
  formData.append('expire', String(auth.expire));
  formData.append('signature', auth.signature);
  formData.append('publicKey', auth.publicKey);
  formData.append('useUniqueFileName', 'true');
  if (folder) {
    formData.append('folder', folder);
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
  return result.url as string;
};
