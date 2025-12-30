import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './entities/room.schema';
import { RoomsService } from './room.service';
import { RoomsController } from './room.controller';
import { RoomGateway } from './room.gateway';
import { CommonModule } from '../../common/common.module';
import {
  StockTrack,
  StockTrackSchema,
} from '../../store-items/store-item/entities/stock-track.schema';
import { Rack, RackSchema } from '../rack/entities/rack.schema';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature(
      [
        { name: Rack.name, schema: RackSchema },
        { name: Room.name, schema: RoomSchema },
        { name: StockTrack.name, schema: StockTrackSchema },
      ],
      'store',
    ),
  ],
  providers: [RoomsService, RoomGateway],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
