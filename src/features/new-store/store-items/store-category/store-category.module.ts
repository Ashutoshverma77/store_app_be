import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreCategoryService } from './store-category.service';
import { StoreCategoryController } from './store-category.controller';
import { StoreCategoryGateway } from './store-category.gateway';
import {
  StoreCategory,
  StoreCategorySchema,
} from './entities/store-category.schema';
import { CommonModule } from '../../common/common.module';
import { StockTrack, StockTrackSchema } from '../store-item/entities/stock-track.schema';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature(
      [
        { name: StoreCategory.name, schema: StoreCategorySchema },
        { name: StockTrack.name, schema: StockTrackSchema },
      ],
      'store',
    ),
  ],
  controllers: [StoreCategoryController],
  providers: [StoreCategoryService, StoreCategoryGateway],
  exports: [StoreCategoryService],
})
export class StoreCategoryModule {}
