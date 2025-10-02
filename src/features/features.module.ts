import { Module } from '@nestjs/common';import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { StoreItemModule } from './store-item/store-item.module';
import { StorePlaceModule } from './store-place/store-place.module';


@Module({
  imports: [AuthModule, UserModule, StoreItemModule, StorePlaceModule]
})
export class FeaturesModule {}
