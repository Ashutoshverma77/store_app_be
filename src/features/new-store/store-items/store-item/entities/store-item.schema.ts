import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class StoreNewItem extends Document {
  // Field 1: ItemName
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreItemName',
    required: true,
    index: true,
  })
  itemNameId: any;

  @Prop({ default: '' })
  itemName: string;

  @Prop({ default: '' })
  itemNameCode: string;

  // Field 2: Rack
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreRack',
    required: true,
    index: true,
  })
  rackId: any;

  @Prop({ default: '' })
  rackName: string;

  // Field 3: Category/Subcategory (same collection; may point to category or subcategory)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreCategory',
    default: null,
    index: true,
  })
  categoryId?: any;

  @Prop({ default: '' })
  categoryLabel: string; // "Category > Subcategory" or "Category"

  // Field 4:
  @Prop({ default: '' })
  unit: string;

  // Field 5:
  @Prop({ default: '' })
  description: string;

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

StoreNewItemSchema.index({ itemName: 1 });
StoreNewItemSchema.index({ rackId: 1, itemNameId: 1 });
