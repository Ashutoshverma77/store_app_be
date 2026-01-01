import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { StoreUnitNameService } from './store-unit-name.service';
import { CreateUnitNameDto, UpdateUnitNameDto } from './dto/unit-name.dto';

@Controller('api/store/unit-names')
export class StoreUnitNameController {
  constructor(private readonly s: StoreUnitNameService) {}

  @Post()
  async create(@Body() dto: CreateUnitNameDto) {
    const data = await this.s.create(dto);
    return { status: true, msg: 'Created', data };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Omit<UpdateUnitNameDto, 'id'>,
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
