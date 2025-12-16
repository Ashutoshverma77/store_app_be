// src/bags/bags.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BagsService } from './bags.service';
import { BagsController } from './bags.controller';
import { Bag, BagSchema } from './entities/bag.schema';
import { Item, ItemSchema } from '../items/entities/item.schema';
import { BagGateway } from './bags.gateway';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: Bag.name, schema: BagSchema },
        { name: Item.name, schema: ItemSchema },
      ],
      'store',
    ),
    ActivityModule,
  ],
  controllers: [BagsController],
  providers: [BagsService, BagGateway],
  // exports: [BagsService, BagGateway],
})
export class BagsModule {}
