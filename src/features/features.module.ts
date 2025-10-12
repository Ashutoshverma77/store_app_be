import { Module } from '@nestjs/common';import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { StoreItemModule } from './store-item/store-item.module';
import { StorePlaceModule } from './store-place/store-place.module';
import { ItemReceiveModule } from './item-receive/item-receive.module';
import { ItemIssueModule } from './item-issue/item-issue.module';
import { DashboardModule } from './dashboard/dashboard.module';


@Module({
  imports: [AuthModule, UserModule, StoreItemModule, StorePlaceModule, ItemReceiveModule, ItemIssueModule, DashboardModule],
 
})
export class FeaturesModule {}
