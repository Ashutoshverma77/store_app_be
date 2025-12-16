// src/sorting-jobs/sorting-jobs.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { TransferSortingJobDto } from './dto/complete-sorting-job.dto';
import { CreateSortingJobDto } from './dto/create-sorting-job.dto';
import { SortingJobsService } from './sorting-job.service';
import { TransferToBagDto } from './dto/transfer-to-bag.dto';

@Controller('sorting-jobs')
export class SortingJobsController {
  constructor(private readonly service: SortingJobsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  create(@Body() dto: CreateSortingJobDto) {
    return this.service.create(dto);
  }

  @Put(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id);
  }

  // transfer for ONE bag at a time
  @Put(':id/transfer-one')
  transferOne(@Param('id') id: string, @Body() dto: TransferSortingJobDto) {
    return this.service.transferOne(id, dto);
  }

  @Put(':id/transfer-to-bag')
  transferToBag(@Param('id') id: string, @Body() dto: TransferToBagDto) {
    return this.service.transferToAnotherBag(id, dto);
  }
}
