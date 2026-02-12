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
import { TransferToBagTwoDto } from './dto/transfer-to-bag-two.dto';
import { SortingJobsGateway } from './sorting-job.gateway';
import { CreateMachineDto } from './dto/create-machine.dto';

@Controller('sorting-jobs')
export class SortingJobsController {
  constructor(
    private readonly service: SortingJobsService,
    private readonly gateway: SortingJobsGateway,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateSortingJobDto) {
    // console.log(dto);
    // return;
    var data = await this.service.create(dto);
    this.gateway.emitAllJobs().catch(() => {});
    return data;
  }

  @Put(':id/start')
  async start(@Param('id') id: string, @Query('createdBy') createdBy?: string) {
    var data = await this.service.start(id);
    this.gateway.emitAllJobs().catch(() => {});
    return data;
  }

  // transfer for ONE bag at a time
  @Put(':id/transfer-one')
  transferOne(@Param('id') id: string, @Body() dto: TransferSortingJobDto) {
    var data = this.service.transferOne(id, dto);
    this.gateway.emitAllJobs().catch(() => {});
    return data;
  }

  @Put(':id/transfer-to-bag')
  transferToBag(@Param('id') id: string, @Body() dto: TransferToBagDto) {
    var data = this.service.transferToAnotherBag(id, dto);
    this.gateway.emitAllJobs().catch(() => {});
    return data;
  }

  @Put(':id/transfer-to-bag-two')
  transferToBagTwo(@Param('id') id: string, @Body() dto: TransferToBagTwoDto) {
    var data = this.service.transferToAnotherBagTwo(id, dto);
    this.gateway.emitAllJobs().catch(() => {});
    return data;
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
    var data = this.service.addBagToJob(jobId, dto, dto.createdBy);
    this.gateway.emitAllJobs().catch(() => {});
    return data;
  }

  @Post('machinetojob')
  addMachineToJob(
    @Body() dto: CreateMachineDto,
    // @Headers('x-user-id') userId?: string,
  ) {
    var data = this.service.machineCreate(dto);
    this.gateway.emitAllJobsMachine().catch(() => {});
    return data;
  }
}
