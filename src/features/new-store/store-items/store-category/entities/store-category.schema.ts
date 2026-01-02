import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class StoreCategory extends Document {
  @Prop({ required: true,  })
  code: string; // CT-AA001

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  remark: string;

  // if parentId exists => subcategory
  @Prop({ default: '' })
  parentId: string;

  @Prop({ default: '' })
  createdBy: string;
}

export const StoreCategorySchema = SchemaFactory.createForClass(StoreCategory);

