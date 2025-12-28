import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class StoreCategory extends Document {
  @Prop({ required: true, unique: true, index: true })
  code: string; // CT-AA001

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ default: '' })
  remark: string;

  // if parentId exists => subcategory
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreCategory',
    default: null,
    index: true,
  })
  parentId?: any;

  @Prop({ default: '' })
  createdBy: string;
}

export const StoreCategorySchema = SchemaFactory.createForClass(StoreCategory);
StoreCategorySchema.index({ name: 1, parentId: 1 });
