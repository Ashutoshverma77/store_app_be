import { Module } from '@nestjs/common';
import { StoreItemNameModule } from './store-item-name/store-item-name.module';
import { StoreCategoryModule } from './store-category/store-category.module';
import { StoreItemModule } from './store-item/store-item.module';

@Module({
  imports: [StoreItemNameModule, StoreCategoryModule, StoreItemModule],
})
export class StoreItemsModule {}
