import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { StoreCategoryService } from './store-category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/store-category.dto';
import { StoreCategoryGateway } from './store-category.gateway';

@Controller('api/store/categories')
export class StoreCategoryController {
  constructor(
    private readonly s: StoreCategoryService,
    private readonly gateway: StoreCategoryGateway,
  ) {}

  @Post()
  async create(@Body() dto: CreateCategoryDto) {
    const data = await this.s.create(dto);
    this.gateway.broadcastAllRoomList().catch(() => {});
    return { status: true, msg: 'Created', data };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Omit<UpdateCategoryDto, 'id'>,
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
