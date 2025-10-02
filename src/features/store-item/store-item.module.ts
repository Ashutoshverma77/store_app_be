import { Module } from '@nestjs/common';
import { StoreItemService } from './store-item.service';
import { StoreItemController } from './store-item.controller';
import { StoreItemGateway } from './store-item.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreItem, StoreItemSchema } from './schema/store-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: StoreItem.name, schema: StoreItemSchema }],
      'store',
    ),
  ],
  controllers: [StoreItemController],
  providers: [StoreItemService, StoreItemGateway],
})
export class StoreItemModule {}
