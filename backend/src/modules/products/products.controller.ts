import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ImportProductsDto } from './dto/import-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findPublic(@Query('context') context?: 'landing' | 'booking') {
    return this.productsService.findPublic(context ?? 'booking');
  }

  @Get('admin')
  @AdminEndpoint()
  findAllAdmin() {
    return this.productsService.findAllAdmin();
  }

  @Post()
  @AdminEndpoint()
  create(@Body() data: CreateProductDto) {
    return this.productsService.create(data);
  }

  @Patch(':id')
  @AdminEndpoint()
  update(@Param('id') id: string, @Body() data: UpdateProductDto) {
    return this.productsService.update(id, data);
  }

  @Delete(':id')
  @AdminEndpoint()
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post('import')
  @AdminEndpoint()
  importProducts(@Body() data: ImportProductsDto) {
    return this.productsService.importFromLocal(data.sourceLocalId, data.targetLocalId);
  }
}
