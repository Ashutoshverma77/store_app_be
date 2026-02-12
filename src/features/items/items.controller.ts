// src/items/items.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from './entities/item.schema';
import { ItemsGateway } from './items.gateway';

type ApiResponse<T> = {
  status: boolean;
  msg: string;
  data: T;
};

@Controller('/api/items')
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly gateway: ItemsGateway,
  ) {}

  @Post()
  async create(@Body() dto: CreateItemDto): Promise<ApiResponse<Item>> {
    var data = await this.itemsService.create(dto);
    this.gateway.broadcastItems().catch(() => {});
    return data;
  }

  @Get()
  findAll(): Promise<Item[]> {
    return this.itemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Item> {
    return this.itemsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItemDto): Promise<Item> {
    return this.itemsService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('createdBy') createdBy?: string,
  ): Promise<void> {
    return this.itemsService.remove(id, createdBy);
  }
}
