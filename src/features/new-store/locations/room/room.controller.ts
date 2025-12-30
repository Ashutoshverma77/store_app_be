import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './room.service';

@Controller('api')
export class RoomsController {
  constructor(private readonly service: RoomsService) {}

  @Post('rooms')
  create(@Body() dto: CreateRoomDto) {
    return this.service.create(dto);
  }

  @Post('rackrooms')
  createRackroom(@Body() dto: any) {
    return this.service.createrackroom(dto);
  }

  @Put('rooms:id')
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.service.update(id, dto);
  }

  @Delete('rooms:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
