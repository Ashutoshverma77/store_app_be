import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MovementType = 'CREATE' | 'EDIT'   | 'APPROVED'  | 'CANCELLED'  | 'RECEIVE'  | 'ISSUE'  | 'SCRAP'  | 'ADJUST'  | 'CLOSED';

@Schema({ timestamps: true, versionKey: false })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'StoreItem', default: '' })
  itemId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'StockPlace', default: '' })
  placeId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Receiving', default: '' })
  receivingId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Receiving', default: '' })
  issueId: Types.ObjectId;
  @Prop({
    required: true,
    enum: [
      'CREATE',
      'EDIT',
      'APPROVED',
      'CANCELLED',
      'RECEIVE',
      'ISSUE',
      'SCRAP',
      'ADJUST',
      'RETURN',
      'CLOSED',
    ],
  })
  type: MovementType;
  @Prop({ required: true }) qty: number; // + for receive/adjust up, - for issue/scrap/adjust down
  @Prop({ default: '' }) refNo: string; // link to receiving number
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  operatedBy: Types.ObjectId;
  @Prop({ default: '' }) note: string;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
