import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class StoreScrap extends Document {
  @Prop({ required: true })
  itemId: string; // IT-AA001

  @Prop({ required: true })
  rackId: string; // IT-AA001

  @Prop({ required: true })
  itemQuantity: string;

  @Prop({ default: '' })
  remark: string;

  @Prop({ default: '' })
  createdBy: string;
}

export const StoreScrapSchema = SchemaFactory.createForClass(StoreScrap);
StoreScrapSchema.index({ name: 1 });
