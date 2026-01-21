import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ImageKitService } from './imagekit.service';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('imagekit')
export class ImageKitController {
  constructor(private readonly imageKitService: ImageKitService) {}

  @Get('sign')
  @AdminEndpoint()
  async signUpload() {
    return this.imageKitService.signUpload();
  }

  @Delete('file/:fileId')
  @AdminEndpoint()
  deleteFile(@Param('fileId') fileId: string) {
    return this.imageKitService.deleteFile(fileId);
  }
}
