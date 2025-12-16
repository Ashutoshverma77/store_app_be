import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivityModule } from './activity.module';
import { ActivityLog, ActivityLogDocument, ActivityAction } from './entities/activity.schema';


export type ActivityActorInput = {
  type?: 'user' | 'system';
  userId?: string | Types.ObjectId;
  name?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
};

export type ActivityEntityInput = {
  type: string;
  id: string;
  label?: string;
};

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(
    @InjectModel(ActivityLog.name, 'store')
    private readonly model: Model<ActivityLogDocument>,
  ) {}

  async log(params: {
    module: ActivityModule;
    action: ActivityAction;
    eventKey: string;
    actor?: ActivityActorInput;
    entities?: ActivityEntityInput[];
    changes?: { before?: any; after?: any; delta?: any };
    meta?: any;
  }) {
    try {
      const actor = params.actor ?? { type: 'system' };

      const actorDoc = {
        type: actor.type ?? 'system',
        userId:
          actor.userId != null
            ? new Types.ObjectId(actor.userId as any)
            : undefined,
        name: actor.name,
        email: actor.email,
        ip: actor.ip,
        userAgent: actor.userAgent,
      };

      await this.model.create({
        module: params.module,
        action: params.action,
        eventKey: params.eventKey,
        actor: actorDoc,
        entities: params.entities ?? [],
        changes: params.changes,
        meta: params.meta,
      });
    } catch (e) {
      // IMPORTANT: do not break business logic
      this.logger.error(`Failed to write activity log: ${String(e)}`);
    }
  }
}
