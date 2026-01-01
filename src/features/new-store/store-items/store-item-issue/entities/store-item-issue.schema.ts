// item-issue.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

class IssueLine {
  @Prop()
  itemId: string;

  @Prop({ required: true, trim: true })
  itemName: string;

  @Prop({ required: true, min: 1 })
  requestedQty: number;

  @Prop({ default: 0, min: 0 })
  approvedQty: number;

  @Prop({ default: 0, min: 0 })
  issuedQty: number;

  // ✅ Good items returned back to stock
  @Prop({ default: 0, min: 0 })
  returnQty: number;

  // ✅ Scrap items (NOT returned to stock)
  @Prop({ default: 0, min: 0 })
  scrapQty: number;

  @Prop({ default: 0, min: 0 })
  approvedRejectQty: number;

  @Prop({ default: 0, min: 0 })
  issuedRejectQty: number;

  @Prop({ default: '' })
  unit: string;
}

class IssueAllocation {
  @Prop()
  itemId: String;

  @Prop({ required: true, trim: true })
  itemName: string;

  @Prop()
  rackId: string;

  @Prop({ required: true, trim: true })
  rackName: string;

  @Prop({ required: true, min: 1 })
  qty: number;

  // total returned (good+scrap) mapped FIFO from allocations
  @Prop({ default: 0, min: 0 })
  returnedQty: number;

  // optional split
  @Prop({ default: 0, min: 0 })
  returnedGoodQty: number;

  @Prop({ default: 0, min: 0 })
  returnedScrapQty: number;

  @Prop({ default: Date.now })
  issuedAt: Date;

  @Prop({ default: "" })
  issuedBy: string;
}

@Schema({ timestamps: true, versionKey: false })
export class ItemIssue {
  @Prop({ required: true, unique: true })
  issNo: string;

  @Prop({ default: '' })
  reason: string;

  @Prop({ default: '' })
  remark: string;

  @Prop({ type: [IssueLine], default: [] })
  lines: IssueLine[];

  // @Prop({
  //   default: 'DRAFT',
  //   enum: ['DRAFT', 'APPROVED', 'CLOSED', 'CANCELLED'],
  // })
  // status: string;

  @Prop()
  createdBy: string;

  @Prop()
  approvedBy?: string;

  @Prop()
  approvedAt?: Date;

  @Prop()
  closedBy?: string;

  @Prop()
  closedAt?: Date;

  @Prop({ type: [IssueAllocation], default: [] })
  allocations: IssueAllocation[];
}

export type ItemIssueDocument = HydratedDocument<ItemIssue>;
export const ItemIssueSchema = SchemaFactory.createForClass(ItemIssue);
