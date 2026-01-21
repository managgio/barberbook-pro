import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductCategoriesService } from './product-categories.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private readonly productCategoriesService: ProductCategoriesService) {}

  @Get()
  findAll(@Query('withProducts') withProducts?: string) {
    const includeProducts = withProducts !== 'false';
    return this.productCategoriesService.findAll(includeProducts);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('withProducts') withProducts?: string) {
    const includeProducts = withProducts !== 'false';
    return this.productCategoriesService.findOne(id, includeProducts);
  }

  @Post()
  @AdminEndpoint()
  create(@Body() data: CreateProductCategoryDto) {
    return this.productCategoriesService.create(data);
  }

  @Patch(':id')
  @AdminEndpoint()
  update(@Param('id') id: string, @Body() data: UpdateProductCategoryDto) {
    return this.productCategoriesService.update(id, data);
  }

  @Delete(':id')
  @AdminEndpoint()
  remove(@Param('id') id: string) {
    return this.productCategoriesService.remove(id);
  }
}
