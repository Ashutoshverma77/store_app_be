import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { RacksService } from './rack.service';

@Controller('api/racks')
export class RacksController {
  constructor(private readonly service: RacksService) {}

  @Post()
  async create(@Body() dto: CreateRackDto) {
    return await this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRackDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
