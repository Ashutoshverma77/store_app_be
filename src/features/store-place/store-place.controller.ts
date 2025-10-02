import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { StorePlaceService } from './store-place.service';
import { StorePlaceGateway } from './store-place.gateway';
import { CreateStorePlaceDto } from './dto/create-store-place.dto';
import { UpdateStorePlaceDto } from './dto/update-store-place.dto';

@Controller('/api/store')
export class StorePlaceController {
  constructor(
    private readonly storePlaceService: StorePlaceService,
    private readonly gateway: StorePlaceGateway,
  ) {}

  @Post('place')
  async create(@Body() createStorePlaceDto: CreateStorePlaceDto) {
    var data = await this.storePlaceService.create(createStorePlaceDto);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Get()
  async findAll() {
    return await this.storePlaceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storePlaceService.findOne(id);
  }

  @Put('place/:id')
  async update(
    @Param('id') id: string,
    @Body() updateStorePlaceDto: UpdateStorePlaceDto,
  ) {
    var data = await this.storePlaceService.update(id, updateStorePlaceDto);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Put('placedelete/:id')
  async remove(@Param('id') id: string) {
    var data = await this.storePlaceService.remove(id);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }
}
