import { Body, Controller, Delete, Param, Patch, Post, Put } from '@nestjs/common';
import { StoreItemService } from './store-item.service';
import { CreateItemDto, TransferItemDto, TransferRackDto, UpdateItemDto } from './dto/store-item.dto';

@Controller('api/store/storeitems')
export class StoreItemController {
  constructor(private readonly s: StoreItemService) {}

  @Post()
  async create(@Body() dto: CreateItemDto) {
    const data = await this.s.create(dto);
    return { status: true, msg: 'Created', data };
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
    await this.s.transferRack(itemId, dto.toRackId);
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
    );
    return { ok: true };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.s.delete(id);
    return { status: true, msg: 'Deleted' };
  }
}
