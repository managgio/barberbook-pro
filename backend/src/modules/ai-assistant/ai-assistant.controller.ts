import { Body, Controller, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AiAssistantService } from './ai-assistant.service';
import { AiChatRequestDto } from './dto/ai-chat.dto';
import { AiAssistantGuard } from './ai-assistant.guard';

interface AiRequest extends Request {
  adminUserId?: string;
}

@Controller('admin/ai-assistant')
@UseGuards(AiAssistantGuard)
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Post('chat')
  async chat(@Body() body: AiChatRequestDto, @Req() req: AiRequest) {
    const adminUserId = req.adminUserId || '';
    return this.aiAssistantService.chat(adminUserId, body.message, body.sessionId);
  }

  @Get('session/:id')
  async getSession(@Param('id') sessionId: string, @Req() req: AiRequest) {
    const adminUserId = req.adminUserId || '';
    return this.aiAssistantService.getSession(adminUserId, sessionId);
  }

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async transcribe(@UploadedFile() file: Express.Multer.File, @Req() req: AiRequest) {
    const adminUserId = req.adminUserId || '';
    return this.aiAssistantService.transcribeAudio(adminUserId, file);
  }
}
