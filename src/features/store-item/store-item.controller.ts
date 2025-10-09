import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { StoreItemService } from './store-item.service';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { StoreItemGateway } from './store-item.gateway';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { UploadBase64Dto } from './schema/upload-image.dto';

@Controller('/api/store')
export class StoreItemController {
  constructor(
    private readonly storeItemService: StoreItemService,
    private readonly gateway: StoreItemGateway,
  ) {}

  @Post('items')
  async create(@Body() createStoreItemDto: CreateStoreItemDto) {
    var data = await this.storeItemService.create(createStoreItemDto);
    console.log(data);
    this.gateway.broadcastStoreItems().catch(() => {});
    return data;
  }

  @Post('scrap')
  async createScrap(@Body() createStoreItemDto: any) {
    var data = await this.storeItemService.scrapFromPlace(createStoreItemDto);

    this.gateway.broadcastStoreItems().catch(() => {});
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
    this.gateway.broadcastStoreItems().catch(() => {});
    return data;
  }

  @Put('itemsdelete/:id')
  async remove(@Param('id') id: string) {
    var data = await this.storeItemService.remove(id);
    this.gateway.broadcastStoreItems().catch(() => {});
    return data;
  }

  @Post(':id/image/base64')
  async uploadImage(@Param('id') id: string, @Body() dto: UploadBase64Dto) {
    const { imageUrl, entity } = await this.storeItemService.uploadImageBase64(
      'item',
      id,
      dto.base64,
      'store-items',
    );
    return { success: true, imageUrl, entity };
  }
}
