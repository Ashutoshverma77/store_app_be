import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { StoreUnitNameService } from './store-unit-name.service';
import { CreateUnitNameDto, UpdateUnitNameDto } from './dto/unit-name.dto';
import { StoreUnitNameGateway } from './store-unit-name.gateway';

@Controller('api/store/unit-names')
export class StoreUnitNameController {
  constructor(
    private readonly s: StoreUnitNameService,
    private readonly gateway: StoreUnitNameGateway,
  ) {}

  @Post()
  async create(@Body() dto: CreateUnitNameDto) {
    const data = await this.s.create(dto);
    this.gateway.broadcastAllList().catch(() => {});
    return { status: true, msg: 'Created', data };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Omit<UpdateUnitNameDto, 'id'>,
  ) {
    const data = await this.s.update({ ...dto, id });
    this.gateway.broadcastAllList().catch(() => {});
    return { status: true, msg: 'Updated', data };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.s.delete(id);
    return { status: true, msg: 'Deleted' };
  }
}
