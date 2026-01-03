import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './room.service';
import { RoomGateway } from './room.gateway';

@Controller('api')
export class RoomsController {
  constructor(
    private readonly service: RoomsService,
    private readonly gateway: RoomGateway,
  ) {}

  @Post('rooms')
  async create(@Body() dto: CreateRoomDto) {
    var data = await this.service.create(dto);
    this.gateway.broadcastAllRoomList().catch(() => {});
    this.gateway.broadcastAllRoomScrapList().catch(() => {});
    return data;
  }

  @Post('rackrooms')
  async createRackroom(@Body() dto: any) {
    var data = await this.service.createrackroom(dto);

    this.gateway.broadcastAllRoomList().catch(() => {});
    this.gateway.broadcastAllRoomScrapList().catch(() => {});
    return data;
  }

  @Put('rooms:id')
  async update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    var data = await this.service.update(id, dto);
    this.gateway.broadcastAllRoomList().catch(() => {});
    this.gateway.broadcastAllRoomScrapList().catch(() => {});
    return data;
  }

  @Delete('rooms:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
