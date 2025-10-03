import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StorePlaceDocument = HydratedDocument<StorePlace>;

@Schema({ timestamps: true })
export class StorePlace {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  code: string;

  @Prop({ trim: true, default: '' })
  type: string;

  @Prop({ type: [Types.ObjectId], ref: 'StorePlaceItemQuantity', default: [] })
  StorePlaceItemQuantityIds: Types.ObjectId[];

  @Prop({ trim: true, default: '' })
  remark: string;

  @Prop({ trim: true, default: '' })
  createdBy: string;
}

export const StorePlaceSchema = SchemaFactory.createForClass(StorePlace);
