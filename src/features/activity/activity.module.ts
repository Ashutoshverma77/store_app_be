import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityLog, ActivityLogSchema } from './entities/activity.schema';
import { ActivityLogsService, } from './activity.service';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: ActivityLog.name, schema: ActivityLogSchema }],
      'store',
    ),
  ],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityModule {}
