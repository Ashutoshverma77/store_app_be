// src/items/schemas/item.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ItemDocument = Item & Document;

@Schema({ timestamps: true })
export class Item {
  @Prop({ required: true, trim: true, unique: true })
  code: string; // item code

  @Prop({ required: true, trim: true })
  name: string;

  // Size
  @Prop({ type: Types.ObjectId, ref: 'Size', required: false })
  sizeId?: Types.ObjectId;

  @Prop({ type: String, required: false })
  size?: string; // denormalized name

  // Grade
  @Prop({ type: Types.ObjectId, ref: 'Grade', required: false })
  gradeId?: Types.ObjectId;

  @Prop({ type: String, required: false })
  grade?: string; // denormalized name

  @Prop({ type: Number, default: 0, min: 0 })
  openingStock: number;

  @Prop({ type: String, required: false })
  unit?: string; // KG, NO, BAG, etc.
}

export const ItemSchema = SchemaFactory.createForClass(Item);
