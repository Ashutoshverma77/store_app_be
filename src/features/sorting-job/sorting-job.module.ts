// src/sorting-job/sorting-job.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SortingJobsController } from './sorting-job.controller';
import { SortingJobsService } from './sorting-job.service';
import { SortingJob, SortingJobSchema } from './entities/sorting-job.schema';
import { Bag, BagSchema } from '../bags/entities/bag.schema';
import { Item, ItemSchema } from '../items/entities/item.schema';
import { SortingJobsGateway } from './sorting-job.gateway';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: SortingJob.name, schema: SortingJobSchema },
        { name: Bag.name, schema: BagSchema },
        { name: Item.name, schema: ItemSchema },
      ],
      'store',
    ),
  ],
  controllers: [SortingJobsController],
  providers: [SortingJobsService, SortingJobsGateway],
  exports: [SortingJobsService],
})
export class SortingJobModule {}
