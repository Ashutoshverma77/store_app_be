import { Module } from '@nestjs/common';
import { StorePlaceService } from './store-place.service';
import { StorePlaceController } from './store-place.controller';
import { StorePlaceGateway } from './store-place.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { StorePlace, StorePlaceSchema } from './schema/store-place.schema';
import { StorePlaceItemQuantity, StorePlaceItemQuantitySchema } from './schema/store-place-item-quantity.schema';

@Module({
  imports: [
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
  ],
  controllers: [StorePlaceController],
  providers: [StorePlaceService, StorePlaceGateway],
})
export class StorePlaceModule {}
