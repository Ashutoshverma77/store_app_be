import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';

@Schema({ _id: false })
export class StoreReceiveLine {
  @Prop()
  itemId: String;

  @Prop()
  rackId?: String;

  @Prop({ type: Number, required: true })
  qty: number;
}
export const StoreReceiveLineSchema =
  SchemaFactory.createForClass(StoreReceiveLine);

@Schema({ timestamps: true })
export class StoreReceive {
  @Prop({ type: String, required: true })
  receivedBy: string;

  @Prop({ type: String, default: '' })
  remark?: string;

  @Prop({ type: [StoreReceiveLineSchema], default: [] })
  lines: StoreReceiveLine[];
}
export const StoreReceiveSchema = SchemaFactory.createForClass(StoreReceive);
