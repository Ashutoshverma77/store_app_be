import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class StoreNewItem extends Document {
  @Prop({ default: '' })
  itemCode: string;

  // Field 1: ItemName
  // @Prop({ default: '' })
  // itemNameId: string;

  @Prop({ default: '' })
  itemName: string;

  // @Prop({ default: '' })
  // itemNameCode: string;

  // Field 2: Rack
  @Prop({ default: [] })
  rackId: [string];

  // Field 3: Category/Subcategory (same collection; may point to category or subcategory)
  @Prop({ default: '' })
  categoryId?: string;

  @Prop({ default: '' })
  categoryLabel: string; // "Category > Subcategory" or "Category"

  // Field 4:
  @Prop({ default: '' })
  unit: string;

  @Prop({ default: '' })
  unitId: string;

  // Field 5:
  @Prop({ default: '' })
  description: string;

  @Prop({ default: false })
  isScrap: boolean;

  // Extra fields
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

  @Prop({ default: '' })
  imageUrl: string;

  @Prop({ default: '' })
  createdBy: string;
}

export const StoreNewItemSchema = SchemaFactory.createForClass(StoreNewItem);
