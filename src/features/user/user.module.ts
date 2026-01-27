import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schema/auth.schema.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { Division, DivisionSchema } from '../auth/schema/division.schema.js';
@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: User.name, schema: UserSchema },
        { name: Division.name, schema: DivisionSchema },
      ],
      'auth',
    ),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
