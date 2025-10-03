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
import { CreateItemReceiveDto } from './dto/create-item-receive.dto';
import { UpdateItemReceiveDto } from './dto/update-item-receive.dto';
import { ReceivingService } from './item-receive.service';
import { ItemReceiveGateway } from './item-receive.gateway';

@Controller('/api/store/')
export class ItemReceiveController {
  constructor(
    private readonly itemReceiveService: ReceivingService,
    private readonly gateway: ItemReceiveGateway,
  ) {}

  @Post('receive')
  async create(@Body() payload: any) {
    var data = await this.itemReceiveService.create(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Get()
  findAll() {
    return this.itemReceiveService.findAll();
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.itemReceiveService.findOne(+id);
  // }

  @Put('receive/:id')
  async update(@Body() payload: any) {
    var data = await this.itemReceiveService.updateDraft(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  // @Delete('receivedelete/:id')
  // remove(@Param('id') id: string) {
  //   return this.itemReceiveService.remove(+id);
  // }

  @Put('receiveapprove/:id')
  async approveReceive(@Param('id') id: string, @Body() payload: any) {
    var data = await this.itemReceiveService.approveReceive(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Put('receivetoplace')
  async receivetoplace(@Body() payload: any) {
    var data = await this.itemReceiveService.receiveToPlaceOne(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }
}
