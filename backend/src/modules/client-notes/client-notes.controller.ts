import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { ClientNotesService } from './client-notes.service';
import { CreateClientNoteDto } from './dto/create-client-note.dto';
import { UpdateClientNoteDto } from './dto/update-client-note.dto';

@Controller('client-notes')
@AdminEndpoint()
export class ClientNotesController {
  constructor(private readonly clientNotesService: ClientNotesService) {}

  @Get()
  list(@Query('userId') userId?: string) {
    if (!userId) {
      throw new BadRequestException('userId es requerido.');
    }
    return this.clientNotesService.listForUser(userId);
  }

  @Post()
  create(@Body() data: CreateClientNoteDto, @Req() req: { adminUserId?: string }) {
    return this.clientNotesService.create(data.userId, data.content, req.adminUserId || null);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateClientNoteDto) {
    return this.clientNotesService.update(id, data.content);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientNotesService.remove(id);
  }
}
