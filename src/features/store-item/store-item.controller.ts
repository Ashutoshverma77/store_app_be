import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { StoreItemService } from './store-item.service';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { StoreItemGateway } from './store-item.gateway';

@Controller('/api/store')
export class StoreItemController {
  constructor(
    private readonly storeItemService: StoreItemService,
    private readonly gateway: StoreItemGateway,
  ) {}

  @Post('items')
  async create(@Body() createStoreItemDto: CreateStoreItemDto) {
    var data = await this.storeItemService.create(createStoreItemDto);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Get()
  async findAll() {
    return await this.storeItemService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storeItemService.findOne(id);
  }

  @Put('items/:id')
  async update(
    @Param('id') id: string,
    @Body() updateStoreItemDto: UpdateStoreItemDto,
  ) {
    var data = await this.storeItemService.update(id, updateStoreItemDto);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Put('itemsdelete/:id')
  async remove(@Param('id') id: string) {
    var data = await this.storeItemService.remove(id);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }
}
