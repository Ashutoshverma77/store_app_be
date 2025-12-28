// src/common/schemas/counter.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'counters' })
export class Counter extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string; // "room" | "rack"

  @Prop({ required: true, default: 0 })
  seq: number; // last used sequence
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
