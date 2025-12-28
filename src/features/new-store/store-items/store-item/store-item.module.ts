import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreItemService } from './store-item.service';
import { StoreItemController } from './store-item.controller';
import { StoreItemGateway } from './store-item.gateway';
import {  StoreNewItem, StoreNewItemSchema } from './entities/store-item.schema';
import {
  StoreCategory,
  StoreCategorySchema,
} from '../store-category/entities/store-category.schema';
import {
  StoreItemName,
  StoreItemNameSchema,
} from '../store-item-name/entities/store-item-name.schema';
import { Rack, RackSchema } from '../../locations/rack/entities/rack.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: StoreNewItem.name, schema: StoreNewItemSchema },
        { name: StoreItemName.name, schema: StoreItemNameSchema },
        { name: StoreCategory.name, schema: StoreCategorySchema },
        { name: Rack.name, schema: RackSchema },
      ],
      'store',
    ),
  ],
  controllers: [StoreItemController],
  providers: [StoreItemService, StoreItemGateway],
})
export class StoreItemModule {}
