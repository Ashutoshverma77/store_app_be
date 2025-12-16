// src/grade/schemas/grade.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GradeDocument = Grade & Document;

@Schema({ timestamps: true })
export class Grade {
  @Prop({ required: true, trim: true, unique: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const GradeSchema = SchemaFactory.createForClass(Grade);
