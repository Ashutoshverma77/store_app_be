import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { Room } from '../../room/entities/room.schema';
export type RackDocument = Rack & Document;

@Schema({ timestamps: true })
export class Rack {
  @Prop({ required: true, unique: true, index: true })
  code: string; // auto generated e.g. RK0001

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ default: '' })
  remark: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Room.name,
    required: true,
    index: true,
  })
  roomId: any;

  // ✅ NEW
  @Prop({ type: Boolean, default: false, index: true })
  isOccupied: boolean;

  // ✅ NEW (reference to item)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreNewItem', // or your Item model name
    default: null,
    index: true,
  })
  itemId: any;

  @Prop({ default: '' })
  roomName: string; // optional denormalized

  @Prop({ default: '' })
  createdBy: string;
}

export const RackSchema = SchemaFactory.createForClass(Rack);
