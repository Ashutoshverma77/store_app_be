import { Module } from '@nestjs/common';
import { StoreItemNameModule } from './store-item-name/store-item-name.module';
import { StoreCategoryModule } from './store-category/store-category.module';
import { StoreNewItemModule } from './store-item/store-item.module';
import { StoreItemIssueModule } from './store-item-issue/store-item-issue.module';

@Module({
  imports: [StoreItemNameModule, StoreCategoryModule, StoreNewItemModule, StoreItemIssueModule],
})
export class StoreItemsModule {}
