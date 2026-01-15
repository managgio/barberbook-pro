import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ServiceCategoriesService } from './service-categories.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('service-categories')
export class ServiceCategoriesController {
  constructor(private readonly serviceCategoriesService: ServiceCategoriesService) {}

  @Get()
  findAll(@Query('withServices') withServices?: string) {
    const includeServices = withServices !== 'false';
    return this.serviceCategoriesService.findAll(includeServices);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('withServices') withServices?: string) {
    const includeServices = withServices !== 'false';
    return this.serviceCategoriesService.findOne(id, includeServices);
  }

  @Post()
  @AdminEndpoint()
  create(@Body() data: CreateServiceCategoryDto) {
    return this.serviceCategoriesService.create(data);
  }

  @Patch(':id')
  @AdminEndpoint()
  update(@Param('id') id: string, @Body() data: UpdateServiceCategoryDto) {
    return this.serviceCategoriesService.update(id, data);
  }

  @Delete(':id')
  @AdminEndpoint()
  remove(@Param('id') id: string) {
    return this.serviceCategoriesService.remove(id);
  }
}
