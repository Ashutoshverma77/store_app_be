import { Module } from '@nestjs/common';
import { StoreScrapService } from './store-scrap.service';
import { StoreScrapController } from './store-scrap.controller';
import { StoreScrapGateway } from './store-scrap.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreItemScrap, StoreScrapSchema } from './entities/store-scrap.schema';
import { UserModule } from 'src/features/user/user.module';
import { Rack, RackSchema } from '../../locations/rack/entities/rack.schema';
import {
  StoreNewItem,
  StoreNewItemSchema,
} from '../store-item/entities/store-item.schema';
import {
  ItemRackQty,
  ItemRackQtySchema,
} from '../../locations/rack/entities/item-rack-qty.schema';
import { StockTrack, StockTrackSchema } from '../store-item/entities/stock-track.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: StoreItemScrap.name, schema: StoreScrapSchema },
        { name: StoreNewItem.name, schema: StoreNewItemSchema },
        { name: Rack.name, schema: RackSchema },
        { name: ItemRackQty.name, schema: ItemRackQtySchema },
        { name: StockTrack.name, schema: StockTrackSchema },
      ],
      'store',
    ),
    UserModule,
  ],
  controllers: [StoreScrapController],
  providers: [StoreScrapService, StoreScrapGateway],
})
export class StoreScrapModule {}
