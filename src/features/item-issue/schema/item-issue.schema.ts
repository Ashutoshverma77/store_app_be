// src/issue/schemas/issue.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

class IssueLine {
  @Prop({ type: Types.ObjectId, ref: 'StoreItem', required: true })
  itemId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  itemName: string; // <-- add item name for easier reference

  @Prop({ required: true, min: 1 })
  requestedQty: number;

  @Prop({ default: 0, min: 0 })
  approvedQty: number;

  @Prop({ default: 0, min: 0 })
  issuedQty: number;

  @Prop({ default: '' })
  unit: string;
}

@Schema({ timestamps: true, versionKey: false })
export class Issue {
  @Prop({ required: true, unique: true })
  issNo: string; // e.g. ISS-2025-00001

  @Prop({ default: '' })
  reason: string;

  @Prop({ default: '' })
  remark: string;

  @Prop({ type: [IssueLine], default: [] })
  lines: IssueLine[];

  @Prop({
    default: 'DRAFT',
    enum: ['DRAFT', 'APPROVED', 'CLOSED', 'CANCELLED'],
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  closedBy?: Types.ObjectId;

  @Prop()
  closedAt?: Date;
}

export const IssueSchema = SchemaFactory.createForClass(Issue);
