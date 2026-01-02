import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { Room } from '../../room/entities/room.schema';
export type RackDocument = Rack & Document;

@Schema({ timestamps: true })
export class Rack {
  @Prop({ required: true })
  code: string; // auto generated e.g. RK0001

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  remark: string;

  @Prop()
  roomId: string;

  // ✅ NEW
  @Prop({ type: Boolean, default: false })
  isOccupied: boolean;

  // ✅ NEW (reference to item)
  @Prop({ default: '' })
  itemId: string;

  @Prop({ default: '' })
  itemName: string;

  @Prop({ default: false })
  isScrap: boolean;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ default: '' })
  roomName: string; // optional denormalized

  @Prop({ default: '' })
  createdBy: string;
}

export const RackSchema = SchemaFactory.createForClass(Rack);
