import { Module } from '@nestjs/common';
import { IssueService } from './item-issue.service';
import { ItemIssueController } from './item-issue.controller';
import { ItemIssueGateway } from './item-issue.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Issue, IssueSchema } from './schema/item-issue.schema';
import {
  StockMovement,
  StockMovementSchema,
} from '../item-receive/schema/stock-movement.schema';
import {
  StoreItem,
  StoreItemSchema,
} from '../store-item/schema/store-item.schema';
import {
  StorePlaceItemQuantity,
  StorePlaceItemQuantitySchema,
} from '../store-place/schema/store-place-item-quantity.schema';
import {
  StorePlace,
  StorePlaceSchema,
} from '../store-place/schema/store-place.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Issue.name, schema: IssueSchema }],
      'store',
    ),
    MongooseModule.forFeature(
      [{ name: StockMovement.name, schema: StockMovementSchema }],
      'store',
    ),
    MongooseModule.forFeature(
      [{ name: StoreItem.name, schema: StoreItemSchema }],
      'store',
    ),
    MongooseModule.forFeature(
      [
        {
          name: StorePlaceItemQuantity.name,
          schema: StorePlaceItemQuantitySchema,
        },
      ],
      'store',
    ),
    MongooseModule.forFeature(
      [
        {
          name: StorePlace.name,
          schema: StorePlaceSchema,
        },
      ],
      'store',
    ),
  ],
  controllers: [ItemIssueController],
  providers: [IssueService, ItemIssueGateway],
})
export class ItemIssueModule {}
