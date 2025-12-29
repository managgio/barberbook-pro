import { Controller, Get } from '@nestjs/common';
import { ImageKitService } from './imagekit.service';

@Controller('imagekit')
export class ImageKitController {
  constructor(private readonly imageKitService: ImageKitService) {}

  @Get('sign')
  signUpload() {
    return this.imageKitService.signUpload();
  }
}
