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

    if (!privateKey || !publicKey || !urlEndpoint) {
      throw new InternalServerErrorException('ImageKit no está configurado');
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expire = Math.floor(Date.now() / 1000) + 60 * 10;
    const signature = crypto.createHmac('sha1', privateKey).update(token + expire).digest('hex');

    return { token, expire, signature, publicKey, urlEndpoint };
  }
}
