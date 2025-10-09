import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { StoreItemService } from './store-item.service';
import { StoreItemController } from './store-item.controller';
import { StoreItemGateway } from './store-item.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreItem, StoreItemSchema } from './schema/store-item.schema';
import {
  StockMovement,
  StockMovementSchema,
} from '../item-receive/schema/stock-movement.schema';
import {
  StorePlace,
  StorePlaceSchema,
} from '../store-place/schema/store-place.schema';
import {
  StorePlaceItemQuantity,
  StorePlaceItemQuantitySchema,
} from '../store-place/schema/store-place-item-quantity.schema';
import { json, urlencoded } from 'express';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: StoreItem.name, schema: StoreItemSchema }],
      'store',
    ),

    MongooseModule.forFeature(
      [{ name: StockMovement.name, schema: StockMovementSchema }],
      'store',
    ),

    MongooseModule.forFeature(
      [{ name: StorePlace.name, schema: StorePlaceSchema }],
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
    UserModule,
  ],
  controllers: [StoreItemController],
  providers: [StoreItemService, StoreItemGateway],
  exports: [StoreItemService],
})
export class StoreItemModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        json({ limit: '50mb' }),
        urlencoded({ limit: '50mb', extended: true }),
      )
      .forRoutes({
        path: 'store-items/:id/image/base64',
        method: RequestMethod.POST,
      });
  }
}
