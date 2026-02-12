// src/sorting-job/sorting-job.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SortingJobsController } from './sorting-job.controller';
import { SortingJobsService } from './sorting-job.service';
import { SortingJob, SortingJobSchema } from './entities/sorting-job.schema';
import { Bag, BagSchema } from '../bags/entities/bag.schema';
import { Item, ItemSchema } from '../items/entities/item.schema';
import { SortingJobsGateway } from './sorting-job.gateway';
import { ActivityModule } from '../activity/activity.module';
import { Machine, MachineSchema } from './entities/machine.schema';
import { StoreCategory, StoreCategorySchema } from '../new-store/store-items/store-category/entities/store-category.schema';
import { StoreNewItem, StoreNewItemSchema } from '../new-store/store-items/store-item/entities/store-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: SortingJob.name, schema: SortingJobSchema },
        { name: Bag.name, schema: BagSchema },
        { name: Item.name, schema: ItemSchema },
        { name: Machine.name, schema: MachineSchema },
        { name: StoreNewItem.name, schema: StoreNewItemSchema },
        { name: StoreCategory.name, schema: StoreCategorySchema },
      ],
      'store',
    ),
    ActivityModule,
  ],
  controllers: [SortingJobsController],
  providers: [SortingJobsService, SortingJobsGateway],
  exports: [SortingJobsService],
})
export class SortingJobModule {}
