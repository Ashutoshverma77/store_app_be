// src/sorting-jobs/sorting-jobs.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Headers,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TransferSortingJobDto } from './dto/complete-sorting-job.dto';
import { CreateSortingJobDto } from './dto/create-sorting-job.dto';
import { SortingJobsService } from './sorting-job.service';
import { TransferToBagDto } from './dto/transfer-to-bag.dto';
import { AddBagToJobDto } from './dto/add-bag-to-job.dto';

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
  start(@Param('id') id: string, @Query('createdBy') createdBy?: string) {
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

  @Get('started/by-item/:itemId')
  findStartedByItem(@Param('itemId') itemId: string) {
    return this.service.findStartedJobsByItem(itemId);
  }

  @Put(':jobId/add-bag')
  addBagToJob(
    @Param('jobId') jobId: string,
    @Body() dto: AddBagToJobDto,
    // @Headers('x-user-id') userId?: string,
  ) {
    return this.service.addBagToJob(jobId, dto, dto.createdBy);
  }
}
