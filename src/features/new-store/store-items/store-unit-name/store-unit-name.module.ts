import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreUnitNameService } from './store-unit-name.service';
import { StoreUnitNameController } from './store-unit-name.controller';
import { StoreUnitNameGateway } from './store-unit-name.gateway';
import { CommonModule } from '../../common/common.module';
import {
  StoreUnitName,
  StoreUnitNameSchema,
} from './entities/store-unit-name.schema';
import { StockTrack, StockTrackSchema } from '../store-item/entities/stock-track.schema';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature(
      [
        { name: StoreUnitName.name, schema: StoreUnitNameSchema },
        { name: StockTrack.name, schema: StockTrackSchema },
      ],
      'store',
    ),
  ],
  controllers: [StoreUnitNameController],
  providers: [StoreUnitNameService, StoreUnitNameGateway],
  exports: [StoreUnitNameService],
})
export class StoreUnitNameModule {}
