import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { CreateItemNameDto, UpdateItemNameDto } from './dto/item-name.dto';
import { StoreItemNameService } from './store-item-name.service';

@Controller('api/store/item-names')
export class StoreItemNameController {
  constructor(private readonly s: StoreItemNameService) {}

  @Post()
  async create(@Body() dto: CreateItemNameDto) {
    const data = await this.s.create(dto);
    return { status: true, msg: 'Created', data };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Omit<UpdateItemNameDto, 'id'>,
  ) {
    const data = await this.s.update({ ...dto, id });
    return { status: true, msg: 'Updated', data };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.s.delete(id);
    return { status: true, msg: 'Deleted' };
  }
}
