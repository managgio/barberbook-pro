import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  findAll() {
    return this.offersService.findAll();
  }

  @Get('active')
  findActive() {
    return this.offersService.findActive();
  }

  @Post()
  @AdminEndpoint()
  create(@Body() data: CreateOfferDto) {
    return this.offersService.create(data);
  }

  @Patch(':id')
  @AdminEndpoint()
  update(@Param('id') id: string, @Body() data: UpdateOfferDto) {
    return this.offersService.update(id, data);
  }

  @Delete(':id')
  @AdminEndpoint()
  remove(@Param('id') id: string) {
    return this.offersService.remove(id);
  }
}
