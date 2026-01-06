import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ImageKitService {
  constructor(private readonly configService: ConfigService) {}

  signUpload() {
    const privateKey = this.configService.get<string>('IMAGEKIT_PRIVATE_KEY');
    const publicKey = this.configService.get<string>('IMAGEKIT_PUBLIC_KEY');
    const urlEndpoint = this.configService.get<string>('IMAGEKIT_URL_ENDPOINT');
    const folder = this.configService.get<string>('IMAGEKIT_FOLDER') || '/barbers';

    if (!privateKey || !publicKey || !urlEndpoint) {
      throw new InternalServerErrorException('ImageKit no está configurado');
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expire = Math.floor(Date.now() / 1000) + 60 * 10;
    const signature = crypto.createHmac('sha1', privateKey).update(token + expire).digest('hex');

    return { token, expire, signature, publicKey, urlEndpoint, folder };
  }

  async deleteFile(fileId: string) {
    const privateKey = this.configService.get<string>('IMAGEKIT_PRIVATE_KEY');
    if (!privateKey) {
      throw new InternalServerErrorException('ImageKit no está configurado');
    }

    const response = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new InternalServerErrorException(
        `No se pudo eliminar la imagen en ImageKit: ${error || response.statusText}`,
      );
    }

    return { success: true };
  }
}
