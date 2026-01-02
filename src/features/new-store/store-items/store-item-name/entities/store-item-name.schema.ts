import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class StoreItemName extends Document {
  @Prop({ required: true,  })
  code: string; // IT-AA001

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ default: '' })
  remark: string;

  @Prop({ default: '' })
  createdBy: string;
}

export const StoreItemNameSchema = SchemaFactory.createForClass(StoreItemName);

