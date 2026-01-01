import {
  Body,
  Controller,
  Delete,
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

@Controller('api/store/storeitems')
export class StoreNewItemController {
  constructor(private readonly s: StoreNewItemService) {}

  @Post()
  async create(@Body() dto: CreateItemDto) {
    const data = await this.s.create(dto);
    return ;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Omit<UpdateItemDto, 'id'>,
  ) {
    const data = await this.s.update({ ...dto, id });
    return { status: true, msg: 'Updated', data };
  }

  @Patch(':id/transfer-rack')
  async transferRack(
    @Param('id') itemId: string,
    @Body() dto: TransferRackDto,
  ) {
    await this.s.transferRack(itemId, dto.toRackId, dto.createdBy);
    return { ok: true };
  }

  @Patch(':id/transfer-item')
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
    return { ok: true };
  }

  @Post('receive')
  async receive(@Body() dto: any) {
    // dto: { itemId, qty, receivedBy, remark? }
    await this.s.receiveItem(dto);
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
}
