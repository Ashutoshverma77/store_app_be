import { Module } from '@nestjs/common';
import { ItemReceiveController } from './item-receive.controller';
import { ItemReceiveGateway } from './item-receive.gateway';
import { ReceivingService } from './item-receive.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Receiving, ReceivingSchema } from './schema/item-receive.schema';
import {
  StockMovement,
  StockMovementSchema,
} from './schema/stock-movement.schema';
import {
  StoreItem,
  StoreItemSchema,
} from '../store-item/schema/store-item.schema';
import {
  StorePlaceItemQuantity,
  StorePlaceItemQuantitySchema,
} from '../store-place/schema/store-place-item-quantity.schema';
import { StorePlace, StorePlaceSchema } from '../store-place/schema/store-place.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Receiving.name, schema: ReceivingSchema }],
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
  controllers: [ItemReceiveController],
  providers: [ReceivingService, ItemReceiveGateway],
})
export class ItemReceiveModule {}
