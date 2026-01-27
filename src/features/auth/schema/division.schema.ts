import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DivisionDocument = Division & Document;

@Schema({ timestamps: true })
export class Division {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  divisionName: string;

  @Prop({ default: '' })
  remark: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const DivisionSchema = SchemaFactory.createForClass(Division);

// Optional: ensure unique index at DB level
DivisionSchema.index({ divisionName: 1 }, { unique: true });
