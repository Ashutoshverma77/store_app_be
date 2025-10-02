// src/store-items/schemas/store-item.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreItemDocument = HydratedDocument<StoreItem>;

@Schema({ timestamps: true })
export class StoreItem {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  category: string;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  totalStockQuantity: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  stockAvailableQuantity: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  stockIssueQuantity: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  stockissueCompleted: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  stockscrapQuantity: number;

  @Prop({ type: [String], default: [] })
  stockPlace: string[];

  @Prop({ required: true })
  unit: string; // e.g. pcs / kg / box

  @Prop({ default: '' })
  imageUrl: string;

  @Prop({ default: '' })
  createdBy: string;
}

export const StoreItemSchema = SchemaFactory.createForClass(StoreItem);
