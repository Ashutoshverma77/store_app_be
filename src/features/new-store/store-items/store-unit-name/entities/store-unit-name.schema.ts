import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class StoreUnitName extends Document {
  @Prop({ required: true,  })
  code: string; // IT-AA001

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ default: '' })
  remark: string;

  @Prop({ default: '' })
  createdBy: string;
}

export const StoreUnitNameSchema = SchemaFactory.createForClass(StoreUnitName);
