import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './entities/room.schema';
import { RoomsService } from './room.service';
import { RoomsController } from './room.controller';
import { RoomGateway } from './room.gateway';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature(
      [{ name: Room.name, schema: RoomSchema }],
      'store',
    ),
  ],
  providers: [RoomsService, RoomGateway],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
