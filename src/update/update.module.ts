import { Module } from '@nestjs/common';
import { UpdateService } from './update.service';
import { UpdateController } from './update.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Version, VersionSchema } from 'src/features/auth/schema/version.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Version.name, schema: VersionSchema }],
      'auth',
    ),
  ],
  controllers: [UpdateController],
  exports: [],
  providers: [UpdateService],
})
export class UpdateModule {}
