import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

export type ActivityModule =
  | 'bags'
  | 'items'
  | 'sorting_jobs'
  | 'sizes'
  | 'grades'
  | 'users'
  | 'auth'
  | 'system';

export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'transfer'
  | 'transferqr'
  | 'start'
  | 'stop'
  | 'restart'
  | 'complete';

@Schema({ _id: false })
export class ActivityActor {
  @Prop({ type: String, enum: ['user', 'system'], default: 'system' })
  type: 'user' | 'system';

  @Prop({ type: Types.ObjectId })
  userId?: Types.ObjectId;

  @Prop({ type: String })
  name?: string;

  @Prop({ type: String })
  email?: string;

  @Prop({ type: String })
  ip?: string;

  @Prop({ type: String })
  userAgent?: string;
}
export const ActivityActorSchema = SchemaFactory.createForClass(ActivityActor);

@Schema({ _id: false })
export class ActivityEntityRef {
  @Prop({ type: String, required: true }) // ex: 'Bag', 'Item'
  type: string;

  @Prop({ type: String, required: true }) // store as string for flexibility
  id: string;

  @Prop({ type: String })
  label?: string; // bagCode, itemName, etc
}
export const ActivityEntityRefSchema =
  SchemaFactory.createForClass(ActivityEntityRef);

@Schema({ _id: false })
export class ActivityChanges {
  @Prop({ type: Object })
  before?: any;

  @Prop({ type: Object })
  after?: any;

  @Prop({ type: Object })
  delta?: any;
}
export const ActivityChangesSchema =
  SchemaFactory.createForClass(ActivityChanges);

@Schema({ timestamps: true })
export class ActivityLog {
  @Prop({ type: String, required: true, enum: [
    'bags','items','sorting_jobs','sizes','grades','users','auth','system'
  ] })
  module: ActivityModule;

  @Prop({ type: String, required: true, enum: [
    'create','update','delete','transfer','transferqr','start','stop','restart','complete'
  ] })
  action: ActivityAction;

  // stable key you can filter on: 'bags.create', 'bags.transfer.other_bag', etc.
  @Prop({ type: String, required: true })
  eventKey: string;

  @Prop({ type: ActivityActorSchema, default: { type: 'system' } })
  actor: ActivityActor;

  @Prop({ type: [ActivityEntityRefSchema], default: [] })
  entities: ActivityEntityRef[];

  @Prop({ type: ActivityChangesSchema })
  changes?: ActivityChanges;

  @Prop({ type: Object })
  meta?: any;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
ActivityLogSchema.index({ module: 1, action: 1, createdAt: -1 });
ActivityLogSchema.index({ 'actor.userId': 1, createdAt: -1 });
