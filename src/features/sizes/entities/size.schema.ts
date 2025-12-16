// src/sizes/schemas/size.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SizeDocument = Size & Document;

@Schema({ timestamps: true })
export class Size {
  @Prop({ required: true, trim: true, unique: true })
  code: string; // e.g. S, M, L, 10MM

  @Prop({ required: true, trim: true })
  name: string; // e.g. Small, 10 MM
}

export const SizeSchema = SchemaFactory.createForClass(Size);
