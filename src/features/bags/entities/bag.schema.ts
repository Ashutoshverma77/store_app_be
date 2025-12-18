// src/bags/schemas/bag.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BagDocument = Bag & Document;

export type ApprovedStatus = 'pending' | 'approved' | 'rejected';
export type TransferType = 'other_bag' | 'sorting_machine';

@Schema({ timestamps: true })
export class Bag {
  @Prop({ default: '' })
  itemId: string; // (or Types.ObjectId if you want relation)

  @Prop({ required: true, trim: true, unique: true })
  bagCode: string;

  @Prop({ default: '' })
  itemName: string;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  itemStock: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  itemUsed: number;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  approvedStatus: ApprovedStatus;

  @Prop({ type: Number, min: 0, default: 0 })
  transferQty: number;

  @Prop({
    type: String,
    enum: ['other_bag', 'sorting_machine', 'inStock'],
    default: 'inStock',
  })
  transferType?: TransferType;

  @Prop({ type: Number, default: 0 })
  maxQty?: number;
}

export const BagSchema = SchemaFactory.createForClass(Bag);
