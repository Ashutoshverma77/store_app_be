import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsModule } from '../room/room.module';
import { Rack, RackSchema } from './entities/rack.schema';
import { RacksController } from './rack.controller';
import { RacksService } from './rack.service';
import { RackGateway } from './rack.gateway';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    CommonModule,
    RoomsModule,
    MongooseModule.forFeature(
      [{ name: Rack.name, schema: RackSchema }],
      'store',
    ),
  ],
  providers: [RacksService, RackGateway],
  controllers: [RacksController],
  exports: [RacksService],
})
export class RacksModule {}
