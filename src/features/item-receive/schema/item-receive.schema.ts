import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

class ReceivingLine {
  @Prop({ type: Types.ObjectId, ref: 'StoreItem', required: true })
  itemId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) requestedQty: number;
  @Prop({ default: 0, min: 0 }) approvedQty: number; // set during approval
  @Prop({ default: 0, min: 0 }) receivedQty: number; // accumulated actual receive
  @Prop({ default: 0, min: 0 }) scrapQty: number; // accumulated actual receive
  @Prop({ default: '' }) unit: string;
}

@Schema({ timestamps: true, versionKey: false })
export class Receiving {
  @Prop({ required: true, unique: true }) recNo: string; // e.g. RCV-2025-00023
  @Prop({ default: '' }) source: string; // supplier or plant name
  @Prop({ default: '' }) remark: string;

  @Prop({ type: [ReceivingLine], default: [] }) lines: ReceivingLine[];

  @Prop({
    default: 'DRAFT',
    enum: ['DRAFT', 'APPROVED', 'CLOSED', 'CANCELLED'],
  })
  status: string;

  @Prop({ default: '' }) createdBy: string;
  @Prop({ default: '' }) approvedBy?: string;
  @Prop() approvedAt?: Date;
  @Prop({ default: '' }) closedBy?: string;
  @Prop() closedAt?: Date;
}

export const ReceivingSchema = SchemaFactory.createForClass(Receiving);
