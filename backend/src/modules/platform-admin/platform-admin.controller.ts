import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { AssignBrandAdminDto } from './dto/assign-brand-admin.dto';
import { RemoveBrandAdminDto } from './dto/remove-brand-admin.dto';
import { ObservabilityService } from '../observability/observability.service';

@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly platformService: PlatformAdminService,
    private readonly observability: ObservabilityService,
  ) {}

  private parseWindowMinutes(raw?: string) {
    const parsed = raw ? Number(raw) : 60;
    if (!Number.isFinite(parsed)) return 60;
    return Math.min(24 * 60, Math.max(5, Math.floor(parsed)));
  }

  @Get('brands')
  listBrands() {
    return this.platformService.listBrands();
  }

  @Get('metrics')
  getUsageMetrics(@Query('window') window?: string) {
    const parsed = window ? Number(window) : 7;
    return this.platformService.getUsageMetrics(Number.isFinite(parsed) ? parsed : 7);
  }

  @Post('metrics/refresh')
  refreshUsageMetrics(@Query('window') window?: string) {
    const parsed = window ? Number(window) : 7;
    return this.platformService.refreshUsageMetrics(Number.isFinite(parsed) ? parsed : 7);
  }

  @Get('observability/web-vitals')
  getWebVitalsSummary(@Query('minutes') minutes?: string) {
    return this.observability.getWebVitalsSummary(this.parseWindowMinutes(minutes));
  }

  @Get('observability/api')
  getApiMetricsSummary(@Query('minutes') minutes?: string) {
    return this.observability.getApiMetricsSummary(this.parseWindowMinutes(minutes));
  }

  @Get('brands/:id')
  getBrand(@Param('id') id: string) {
    return this.platformService.getBrand(id);
  }

  @Post('brands')
  createBrand(@Body() data: CreateBrandDto) {
    return this.platformService.createBrand(data);
  }

  @Patch('brands/:id')
  updateBrand(@Param('id') id: string, @Body() data: UpdateBrandDto) {
    return this.platformService.updateBrand(id, data);
  }

  @Delete('brands/:id')
  deleteBrand(@Param('id') id: string) {
    return this.platformService.deleteBrand(id);
  }

  @Get('brands/:id/locations')
  listLocations(@Param('id') brandId: string) {
    return this.platformService.listLocations(brandId);
  }

  @Post('brands/:id/locations')
  createLocation(@Param('id') brandId: string, @Body() data: CreateLocationDto) {
    return this.platformService.createLocation(brandId, data);
  }

  @Patch('locations/:id')
  updateLocation(@Param('id') id: string, @Body() data: UpdateLocationDto) {
    return this.platformService.updateLocation(id, data);
  }

  @Delete('locations/:id')
  deleteLocation(@Param('id') id: string) {
    return this.platformService.deleteLocation(id);
  }

  @Get('brands/:id/config')
  getBrandConfig(@Param('id') brandId: string) {
    return this.platformService.getBrandConfig(brandId);
  }

  @Get('brands/:id/admins')
  listBrandAdmins(@Param('id') brandId: string) {
    return this.platformService.listBrandAdmins(brandId);
  }

  @Post('brands/:id/admins')
  assignBrandAdmin(@Param('id') brandId: string, @Body() data: AssignBrandAdminDto) {
    return this.platformService.assignBrandAdmin(brandId, data);
  }

  @Delete('brands/:id/admins')
  removeBrandAdmin(@Param('id') brandId: string, @Body() data: RemoveBrandAdminDto) {
    return this.platformService.removeBrandAdmin(brandId, data);
  }

  @Patch('brands/:id/config')
  updateBrandConfig(@Param('id') brandId: string, @Body() data: UpdateConfigDto) {
    return this.platformService.updateBrandConfig(brandId, data.data);
  }

  @Get('locations/:id/config')
  getLocationConfig(@Param('id') localId: string) {
    return this.platformService.getLocationConfig(localId);
  }

  @Patch('locations/:id/config')
  updateLocationConfig(@Param('id') localId: string, @Body() data: UpdateConfigDto) {
    return this.platformService.updateLocationConfig(localId, data.data);
  }
}
