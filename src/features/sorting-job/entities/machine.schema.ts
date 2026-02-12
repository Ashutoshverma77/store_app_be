import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class Machine {
  @Prop({ required: true, unique: true, index: true })
  machineCode: string; // e.g. MC-000001 OR M-AA006 (your choice)

  @Prop({ required: true, trim: true })
  machineName: string;

  // Link to StoreCategory
  @Prop({
    required: true,
  })
  categoryId: string;

  // Optional: link to StoreNewItem (if machine has a default item)
  @Prop({ default: '' })
  itemId?: string ;

  @Prop({ default: '' })
  remark?: string;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ default: '' })
  createdBy?: string;

  @Prop({ default: '' })
  updatedBy?: string;
}

export type MachineDocument = HydratedDocument<Machine>;
export const MachineSchema = SchemaFactory.createForClass(Machine);
