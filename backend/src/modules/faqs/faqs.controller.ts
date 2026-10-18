import { UseGuards } from '@nestjs/common';
import { WebsiteAccessGuard } from '../website/website-access.guard';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { CreateFaqDto, FaqVersionDto, ReorderFaqsDto, UpdateFaqDto } from './dto/faq.dto';
import { FaqsService } from './faqs.service';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqs: FaqsService) {}
  @Get()
  list() { return this.faqs.list(); }
}

@Controller('admin/faqs')
@AdminEndpoint()
@UseGuards(WebsiteAccessGuard)
export class AdminFaqsController {
  constructor(private readonly faqs: FaqsService) {}
  @Get()
  list() { return this.faqs.list(true); }
  @Post()
  create(@Body() data: CreateFaqDto) { return this.faqs.create(data); }
  @Patch('order')
  reorder(@Body() data: ReorderFaqsDto) { return this.faqs.reorder(data); }
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateFaqDto) { return this.faqs.update(id, data); }
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Body() data: FaqVersionDto) { return this.faqs.remove(id, data.version); }
}
