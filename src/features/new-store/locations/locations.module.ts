import { Module } from '@nestjs/common';
import { RoomsModule } from './room/room.module';
import { RacksModule } from './rack/rack.module';

@Module({
  imports: [RoomsModule, RacksModule],
})
export class LocationsModule {}
