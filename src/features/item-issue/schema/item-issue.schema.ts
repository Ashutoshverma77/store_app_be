// issue.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

class IssueLine {
  @Prop({ type: Types.ObjectId, ref: 'StoreItem', required: true })
  itemId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  itemName: string;

  @Prop({ required: true, min: 1 })
  requestedQty: number;

  @Prop({ default: 0, min: 0 })
  approvedQty: number;

  @Prop({ default: 0, min: 0 })
  issuedQty: number;

  @Prop({ default: 0, min: 0 })
  returnQty: number;

  @Prop({ default: '' })
  unit: string;
}

// ✅ NEW: Issued allocations per place (this solves your problem)
class IssueAllocation {
  @Prop({ type: Types.ObjectId, ref: 'StoreItem', required: true })
  itemId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  itemName: string;

  @Prop({ type: Types.ObjectId, ref: 'StorePlace', required: true })
  placeId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  placeName: string;

  @Prop({ required: true, min: 1 })
  qty: number; // issued qty from this place

  @Prop({ default: 0, min: 0 })
  returnedQty: number; // returned against this allocation

  @Prop({ default: Date.now })
  issuedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  issuedBy?: Types.ObjectId;
}

@Schema({ timestamps: true, versionKey: false })
export class Issue {
  @Prop({ required: true, unique: true })
  issNo: string;

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

  // ✅ NEW FIELD
  @Prop({ type: [IssueAllocation], default: [] })
  allocations: IssueAllocation[];
}

export type IssueDocument = HydratedDocument<Issue>;
export const IssueSchema = SchemaFactory.createForClass(Issue);
