import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { LocationsModule } from './locations/locations.module';
import { StoreItemsModule } from './store-items/store-items.module';

@Module({
  imports: [CommonModule, LocationsModule, StoreItemsModule],
})
export class NewStoreModule {}
