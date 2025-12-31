import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StoreScrapService } from './store-scrap.service';
import { CreateStoreScrapDto } from './dto/create-store-scrap.dto';
import { UpdateStoreScrapDto } from './dto/update-store-scrap.dto';

@Controller('store-scrap')
export class StoreScrapController {
  constructor(private readonly storeScrapService: StoreScrapService) {}

  @Post()
  create(@Body() createStoreScrapDto: CreateStoreScrapDto) {
    return this.storeScrapService.create(createStoreScrapDto);
  }

  @Get()
  findAll() {
    return this.storeScrapService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storeScrapService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStoreScrapDto: UpdateStoreScrapDto) {
    return this.storeScrapService.update(+id, updateStoreScrapDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storeScrapService.remove(+id);
  }
}
