import { Module } from '@nestjs/common';
import { IssueService } from './store-item-issue.service';
import { IssueController } from './store-item-issue.controller';
import { IssueGateway } from './store-item-issue.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Rack, RackSchema } from '../../locations/rack/entities/rack.schema';
import {
  StoreCategory,
  StoreCategorySchema,
} from '../store-category/entities/store-category.schema';
import {
  StoreItemName,
  StoreItemNameSchema,
} from '../store-item-name/entities/store-item-name.schema';
import {
  StoreNewItem,
  StoreNewItemSchema,
} from '../store-item/entities/store-item.schema';
import { ItemIssue, ItemIssueSchema } from './entities/store-item-issue.schema';
import {
  StockTrack,
  StockTrackSchema,
} from '../store-item/entities/stock-track.schema';
import {
  ItemRackQty,
  ItemRackQtySchema,
} from '../../locations/rack/entities/item-rack-qty.schema';
import { StoreNewItemModule } from '../store-item/store-item.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: StoreNewItem.name, schema: StoreNewItemSchema },
        { name: StoreItemName.name, schema: StoreItemNameSchema },
        { name: StoreCategory.name, schema: StoreCategorySchema },
        { name: Rack.name, schema: RackSchema },
        { name: ItemIssue.name, schema: ItemIssueSchema },
        { name: StockTrack.name, schema: StockTrackSchema },
        { name: ItemRackQty.name, schema: ItemRackQtySchema },
      ],
      'store',
    ),
    StoreNewItemModule,
  ],
  controllers: [IssueController],
  providers: [IssueService, IssueGateway],
})
export class StoreItemIssueModule {}
