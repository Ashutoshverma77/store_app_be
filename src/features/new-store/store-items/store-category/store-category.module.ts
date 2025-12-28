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

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature(
      [{ name: StoreCategory.name, schema: StoreCategorySchema }],
      'store',
    ),
  ],
  controllers: [StoreCategoryController],
  providers: [StoreCategoryService, StoreCategoryGateway],
  exports: [StoreCategoryService],
})
export class StoreCategoryModule {}
