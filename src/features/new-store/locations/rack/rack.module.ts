import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsModule } from '../room/room.module';
import { Rack, RackSchema } from './entities/rack.schema';
import { RacksController } from './rack.controller';
import { RacksService } from './rack.service';
import { RackGateway } from './rack.gateway';
import { CommonModule } from '../../common/common.module';
import {
  StockTrack,
  StockTrackSchema,
} from '../../store-items/store-item/entities/stock-track.schema';
import {
  ItemRackQty,
  ItemRackQtySchema,
} from './entities/item-rack-qty.schema';
import { StoreNewItem, StoreNewItemSchema } from '../../store-items/store-item/entities/store-item.schema';

@Module({
  imports: [
    CommonModule,
    RoomsModule,
    MongooseModule.forFeature(
      [
        { name: StoreNewItem.name, schema: StoreNewItemSchema },
        { name: Rack.name, schema: RackSchema },
        { name: ItemRackQty.name, schema: ItemRackQtySchema },
        { name: StockTrack.name, schema: StockTrackSchema },
      ],
      'store',
    ),
  ],
  providers: [RacksService, RackGateway],
  controllers: [RacksController],
  exports: [RacksService],
})
export class RacksModule {}
