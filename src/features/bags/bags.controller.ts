// src/bags/bags.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
} from '@nestjs/common';
import { BagsService } from './bags.service';
import { CreateBagDto } from './dto/create-bag.dto';
import { UpdateBagDto } from './dto/update-bag.dto';
import { Bag } from './entities/bag.schema';
import { TransferBagDto } from './dto/transfer-bag.dto';
import { AddBagStockDto } from './dto/add-bag-stock.dto';
import { BagGateway } from './bags.gateway';

@Controller('/api/bags')
export class BagsController {
  constructor(
    private readonly bagsService: BagsService,
    private readonly gateway: BagGateway,
  ) {}

  @Post()
  async create(@Body() createBagDto: CreateBagDto) {
    return await this.bagsService.create(createBagDto);
  }

  @Get()
  async findAll(): Promise<Bag[]> {
    return await this.bagsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Bag> {
    return await this.bagsService.findOne(id);
  }

  @Put(':id/update')
  async update(@Param('id') id: string, @Body() updateBagDto: UpdateBagDto) {
    var data = await this.bagsService.update(id, updateBagDto);
    this.gateway.emitAllBags().catch(() => {});
    return data;
  }

  @Put(':id/add-stock')
  async addStock(@Param('id') id: string, @Body() dto: AddBagStockDto) {
    var data = await this.bagsService.addStock(id, dto);
    this.gateway.emitAllBags().catch(() => {});
    return data;
  }

  @Put(':id/transfer-to-bag')
  async transferToBag(@Body() dto: TransferBagDto) {
    const data = await this.bagsService.transferToAnotherBag(dto);
    this.gateway.emitAllBags().catch(() => {});
    return { status: true, msg: 'Transferred successfully', data };
  }
  @Delete(':id')
  remove(@Param('id') id: string, @Query('createdBy') createdBy?: string) {
    return this.bagsService.remove(id, createdBy);
  }
}
