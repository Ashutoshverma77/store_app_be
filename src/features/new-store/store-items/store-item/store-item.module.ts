import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreNewItemController } from './store-item.controller';
import { StoreNewItemGateway } from './store-item.gateway';
import { StoreNewItem, StoreNewItemSchema } from './entities/store-item.schema';
import {
  StoreCategory,
  StoreCategorySchema,
} from '../store-category/entities/store-category.schema';
import {
  StoreItemName,
  StoreItemNameSchema,
} from '../store-item-name/entities/store-item-name.schema';
import { Rack, RackSchema } from '../../locations/rack/entities/rack.schema';
import {
  StoreReceive,
  StoreReceiveSchema,
} from './entities/store-receive.schema';
import { StockTrack, StockTrackSchema } from './entities/stock-track.schema';
import { StoreNewItemService } from './store-item.service';
import { UserModule } from 'src/features/user/user.module';
import { CommonModule } from '../../common/common.module';
import { ItemRackQty, ItemRackQtySchema } from '../../locations/rack/entities/item-rack-qty.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: StoreNewItem.name, schema: StoreNewItemSchema },
        { name: StoreItemName.name, schema: StoreItemNameSchema },
        { name: StoreCategory.name, schema: StoreCategorySchema },
        { name: Rack.name, schema: RackSchema },
        { name: StoreReceive.name, schema: StoreReceiveSchema },
        { name: StockTrack.name, schema: StockTrackSchema },
        { name: ItemRackQty.name, schema: ItemRackQtySchema },
      ],
      'store',
    ),
    CommonModule,
    UserModule,
  ],
  controllers: [StoreNewItemController],
  providers: [StoreNewItemService, StoreNewItemGateway],
})
export class StoreNewItemModule {}
