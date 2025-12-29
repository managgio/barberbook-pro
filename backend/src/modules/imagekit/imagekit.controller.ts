import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ImageKitService } from './imagekit.service';

@Controller('imagekit')
export class ImageKitController {
  constructor(private readonly imageKitService: ImageKitService) {}

  @Get('sign')
  signUpload() {
    return this.imageKitService.signUpload();
  }

  @Delete('file/:fileId')
  deleteFile(@Param('fileId') fileId: string) {
    return this.imageKitService.deleteFile(fileId);
  }
}
