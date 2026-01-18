import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { StoreNewItemService } from './store-item.service';
import {
  CreateItemDto,
  TransferItemDto,
  TransferRackDto,
  UpdateItemDto,
} from './dto/store-item.dto';
import { UploadBase64Dto } from 'src/features/store-item/schema/upload-image.dto';
import { StoreNewItemGateway } from './store-item.gateway';

@Controller('api/store/storeitems')
export class StoreNewItemController {
  constructor(
    private readonly s: StoreNewItemService,
    private readonly gateway: StoreNewItemGateway,
  ) {}

  @Post()
  async create(@Body() dto: CreateItemDto) {
    console.log(dto);

    // return;
    const data = await this.s.create(dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    return data;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Omit<UpdateItemDto, 'id'>,
  ) {
    const data = await this.s.update({ ...dto, id });
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    return { status: true, msg: 'Updated', data };
  }

  @Put(':id/transfer-rack')
  async transferRack(
    @Param('id') itemId: string,
    @Body() dto: TransferRackDto,
  ) {
    await this.s.removeRackFromItem(itemId, dto.toRackId, dto.createdBy);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    return { ok: true };
  }

  @Put('remove-rack')
  async removeRack(@Body() dto: any) {
    await this.s.removeRack(dto.toRackId, dto.createdBy);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    return { ok: true };
  }

  @Put(':id/transfer-item')
  async transferItem(
    @Param('id') itemId: string,
    @Body() dto: TransferItemDto,
  ) {
    await this.s.transferItemQty(
      itemId,
      dto.fromRackId,
      dto.toRackId,
      dto.qty,
      dto.createdBy,
    );
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    return { ok: true };
  }

  @Post('receive')
  async receive(@Body() dto: any) {
    // dto: { itemId, qty, receivedBy, remark? }
    await this.s.receiveItem(dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.gateway.broadcastAllReceiveList().catch(() => {});
    return { status: true, msg: 'Received successfully' };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.s.delete(id);
    return { status: true, msg: 'Deleted' };
  }

  @Post(':id/image/base64')
  async uploadImage(@Param('id') id: string, @Body() dto: UploadBase64Dto) {
    const { imageUrl, entity } = await this.s.uploadImageBase64(
      'item',
      id,
      dto.base64,
      'store-items',
    );
    // this.gateway.broadcastStoreItems().catch(() => {});
    return { success: true, imageUrl, entity };
  }

  @Get('by-item-scrap/:id')
  getScrap(@Param('id') id: string) {
    return this.s.scrapByItemId(id);
  }
}
