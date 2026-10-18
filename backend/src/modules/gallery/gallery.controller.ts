import { UseGuards } from '@nestjs/common';
import { WebsiteAccessGuard } from '../website/website-access.guard';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { GalleryCategoryDto, GalleryItemDto, GalleryOrderDto, GalleryVersionDto, UpdateGalleryCategoryDto, UpdateGalleryItemDto } from './dto/gallery.dto';
import { GalleryService } from './gallery.service';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}
  @Get() list() { return this.gallery.list(); }
}

@Controller('admin/gallery')
@AdminEndpoint()
@UseGuards(WebsiteAccessGuard)
export class AdminGalleryController {
  constructor(private readonly gallery: GalleryService) {}
  @Get() list() { return this.gallery.list(true); }
  @Post('items') createItem(@Body() data: GalleryItemDto) { return this.gallery.saveItem(null, data); }
  @Patch('items/order') reorder(@Body() data: GalleryOrderDto) { return this.gallery.reorder(data.expectedIds, data.orderedIds); }
  @Patch('items/:id') updateItem(@Param('id') id: string, @Body() data: UpdateGalleryItemDto) { return this.gallery.saveItem({ id, version: data.version }, data); }
  @Delete('items/:id') @HttpCode(204)
  removeItem(@Param('id') id: string, @Body() data: GalleryVersionDto) { return this.gallery.removeItem(id, data.version); }
  @Post('categories') createCategory(@Body() data: GalleryCategoryDto) { return this.gallery.saveCategory(null, data.name); }
  @Patch('categories/:id') updateCategory(@Param('id') id: string, @Body() data: UpdateGalleryCategoryDto) { return this.gallery.saveCategory({ id, version: data.version }, data.name); }
  @Delete('categories/:id') @HttpCode(204)
  removeCategory(@Param('id') id: string, @Body() data: GalleryVersionDto) { return this.gallery.removeCategory(id, data.version); }
}
