import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MovementType = 'RECEIVE' | 'ISSUE' | 'SCRAP' | 'ADJUST';

@Schema({ timestamps: true, versionKey: false })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'StoreItem', required: true })
  itemId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'StockPlace', required: true })
  placeId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Receiving', default: '' })
  receivingId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Receiving', default: '' })
  issueId: Types.ObjectId;
  @Prop({
    required: true,
    enum: ['RECEIVE', 'ISSUE', 'SCRAP', 'ADJUST', 'RETURN'],
  })
  type: MovementType;
  @Prop({ required: true }) qty: number; // + for receive/adjust up, - for issue/scrap/adjust down
  @Prop({ default: '' }) refNo: string; // link to receiving number
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  operatedBy: Types.ObjectId;
  @Prop({ default: '' }) note: string;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
