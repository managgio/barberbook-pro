import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommunicationsGuard } from './communications.guard';
import { RequireCommunicationPermission } from './communications-permission.decorator';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { ExecuteCommunicationDto } from './dto/execute-communication.dto';
import { ListCommunicationsDto } from './dto/list-communications.dto';
import { PreviewCommunicationDto } from './dto/preview-communication.dto';
import { UpdateChannelPreferenceDto } from './dto/update-channel-preference.dto';
import { UpdateCommunicationDraftDto } from './dto/update-communication-draft.dto';

@Controller('admin/communications')
@UseGuards(CommunicationsGuard)
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get('templates')
  @RequireCommunicationPermission('communications:view')
  getTemplates() {
    return this.communicationsService.getTemplates();
  }

  @Get('channel-preference')
  @RequireCommunicationPermission('communications:view')
  getChannelPreference() {
    return this.communicationsService.getChannelPreference();
  }

  @Patch('channel-preference')
  @RequireCommunicationPermission('communications:create_draft')
  updateChannelPreference(
    @Body() dto: UpdateChannelPreferenceDto,
    @Req() req: { adminUserId?: string },
  ) {
    return this.communicationsService.updateChannelPreference(dto, req.adminUserId || null);
  }

  @Get()
  @RequireCommunicationPermission('communications:view_history')
  list(@Query() dto: ListCommunicationsDto) {
    return this.communicationsService.list(dto);
  }

  @Get(':id')
  @RequireCommunicationPermission('communications:view_history')
  getDetail(@Param('id') id: string) {
    return this.communicationsService.getDetail(id);
  }

  @Post('preview')
  @RequireCommunicationPermission('communications:preview')
  preview(@Body() dto: PreviewCommunicationDto) {
    return this.communicationsService.preview(dto);
  }

  @Post()
  @RequireCommunicationPermission('communications:create_draft')
  create(
    @Body() dto: CreateCommunicationDto,
    @Req() req: { adminUserId?: string },
  ) {
    return this.communicationsService.create(dto, req.adminUserId || null);
  }

  @Patch(':id/draft')
  @RequireCommunicationPermission('communications:create_draft')
  updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateCommunicationDraftDto,
    @Req() req: { adminUserId?: string },
  ) {
    return this.communicationsService.updateDraft(id, dto, req.adminUserId || null);
  }

  @Post(':id/duplicate')
  @RequireCommunicationPermission('communications:duplicate')
  duplicate(@Param('id') id: string, @Req() req: { adminUserId?: string }) {
    return this.communicationsService.duplicate(id, req.adminUserId || null);
  }

  @Post(':id/cancel-scheduled')
  @RequireCommunicationPermission('communications:cancel_scheduled')
  cancelScheduled(@Param('id') id: string, @Req() req: { adminUserId?: string }) {
    return this.communicationsService.cancelScheduled(id, req.adminUserId || null);
  }

  @Post(':id/execute')
  @RequireCommunicationPermission('communications:execute')
  execute(
    @Param('id') id: string,
    @Body() dto: ExecuteCommunicationDto,
    @Req() req: { adminUserId?: string },
  ) {
    return this.communicationsService.execute(id, dto, req.adminUserId || null);
  }
}
