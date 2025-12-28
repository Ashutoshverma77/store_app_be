import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, unique: true, index: true })
  code: string; // auto generated e.g. RM0001

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ default: '' })
  remark: string;

  @Prop({ default: '' })
  createdBy: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
