import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { RacksService } from './rack.service';
import { RackGateway } from './rack.gateway';

@Controller('api/racks')
export class RacksController {
  constructor(
    private readonly service: RacksService,
    private readonly gateway: RackGateway,
  ) {}

  @Post()
  async create(@Body() dto: CreateRackDto) {
    var data = await this.service.create(dto);
    this.gateway.broadcastAllRackList(data.data.roomId).catch(() => {});
    this.gateway.broadcastAllRackScrapList(data.data.roomId).catch(() => {});
    return data;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRackDto) {
    var data = await this.service.update(id, dto);
    this.gateway.broadcastAllRackList(data.data.roomId).catch(() => {});
    this.gateway.broadcastAllRackScrapList(data.data.roomId).catch(() => {});
    return;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get('by-item/:id')
  getByItem(@Param('id') id: string) {
    return this.service.findRackByItem(id);
  }

  @Get('by-room/:id')
  getByRoom(@Param('id') id: string) {
    return this.service.findRackByRoom(id);
  }
}
