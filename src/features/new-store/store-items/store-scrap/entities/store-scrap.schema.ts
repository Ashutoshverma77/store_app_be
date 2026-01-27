import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class StoreItemScrap extends Document {
  @Prop({ required: true })
  itemId: string; // IT-AA001

  @Prop({ required: true })
  itemName: string; // IT-AA001

  @Prop({ required: true })
  itemCode: string; // IT-AA001

  @Prop({ required: true })
  roomId: string; // IT-AA001

  @Prop({ required: true })
  roomCode: string; // IT-AA001

  @Prop({ required: true })
  rackId: string; // IT-AA001

  @Prop({ required: true })
  rackCode: string; // IT-AA001

  @Prop({ required: true })
  itemQuantity: number;

  @Prop({ default: '' })
  remark: string;

  @Prop({ default: '' })
  createdBy: string;

  @Prop({ default: '' })
  createdByName: string;
}

export const StoreScrapSchema = SchemaFactory.createForClass(StoreItemScrap);
