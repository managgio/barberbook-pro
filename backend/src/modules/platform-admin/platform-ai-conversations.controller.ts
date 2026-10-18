import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { PlatformAiInputSource } from '../../contexts/ai-orchestration/ports/outbound/platform-ai-conversation-read.port';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAiConversationsService } from './platform-ai-conversations.service';

@Controller('platform/ai-conversations')
@UseGuards(PlatformAdminGuard)
export class PlatformAiConversationsController {
  constructor(private readonly conversations: PlatformAiConversationsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('days') days?: string,
    @Query('brandId') brandId?: string,
    @Query('localId') localId?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
  ) {
    const requestedDays = Math.floor(Number(days) || 30);
    const normalizedDays = [1, 7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const normalizedSource = ['typed', 'voice', 'template'].includes(source || '')
      ? source as PlatformAiInputSource
      : undefined;
    return this.conversations.list({
      page: Math.max(1, Math.floor(Number(page) || 1)),
      pageSize: Math.min(50, Math.max(10, Math.floor(Number(pageSize) || 25))),
      days: normalizedDays,
      brandId: brandId?.trim() || undefined,
      localId: localId?.trim() || undefined,
      source: normalizedSource,
      search: search?.trim().slice(0, 120) || undefined,
    });
  }

  @Get(':sessionId')
  async getById(@Param('sessionId') sessionId: string) {
    const session = await this.conversations.getById(sessionId);
    if (!session) throw new NotFoundException('Conversación no encontrada.');
    return session;
  }
}
