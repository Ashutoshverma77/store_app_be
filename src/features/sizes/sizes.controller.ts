// src/sizes/sizes.controller.ts
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
import { SizesService } from './sizes.service';
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { Size } from './entities/size.schema';

@Controller('/api/sizes')
export class SizesController {
  constructor(private readonly sizesService: SizesService) {}

  @Post()
  async create(@Body() dto: CreateSizeDto): Promise<Size> {
    return await this.sizesService.create(dto);
  }

  @Get()
  findAll(): Promise<Size[]> {
    return this.sizesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Size> {
    return this.sizesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSizeDto): Promise<Size> {
    return this.sizesService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('createdBy') createdBy?: string,
  ): Promise<void> {
    return this.sizesService.remove(id, createdBy);
  }
}
