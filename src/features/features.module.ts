import { Module } from '@nestjs/common';import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';


@Module({
  imports: [AuthModule, UserModule]
})
export class FeaturesModule {}
