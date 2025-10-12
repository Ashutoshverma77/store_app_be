import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreItem, StoreItemSchema } from '../store-item/schema/store-item.schema';
import { StorePlace, StorePlaceSchema } from '../store-place/schema/store-place.schema';
import { Receiving, ReceivingSchema } from '../item-receive/schema/item-receive.schema';
import { Issue, IssueSchema } from '../item-issue/schema/item-issue.schema';
import { StockMovement, StockMovementSchema } from '../item-receive/schema/stock-movement.schema';

@Module({
  imports: [
    // Use your named connection "store" (as in your existing code)
    MongooseModule.forFeature(
      [
        { name: StoreItem.name, schema: StoreItemSchema },
        { name: StorePlace.name, schema: StorePlaceSchema },
        { name: Receiving.name, schema: ReceivingSchema },
        { name: Issue.name, schema: IssueSchema },
        { name: StockMovement.name, schema: StockMovementSchema },
      ],
      'store',
    ),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
