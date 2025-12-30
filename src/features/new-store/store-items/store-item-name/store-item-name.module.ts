import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreItemNameService } from './store-item-name.service';
import { StoreItemNameController } from './store-item-name.controller';
import { StoreItemNameGateway } from './store-item-name.gateway';
import { CommonModule } from '../../common/common.module';
import {
  StoreItemName,
  StoreItemNameSchema,
} from './entities/store-item-name.schema';
import {
  StockTrack,
  StockTrackSchema,
} from '../store-item/entities/stock-track.schema';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature(
      [
        { name: StoreItemName.name, schema: StoreItemNameSchema },
        { name: StockTrack.name, schema: StockTrackSchema },
      ],
      'store',
    ),
  ],
  controllers: [StoreItemNameController],
  providers: [StoreItemNameService, StoreItemNameGateway],
  exports: [StoreItemNameService],
})
export class StoreItemNameModule {}
