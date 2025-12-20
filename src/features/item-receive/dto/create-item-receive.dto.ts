import { IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ReceiveStockDto {
  @IsMongoId()
  itemId: string;

  @IsNumber()
  @Min(1)
  qty: number;

  // optional (only needed if creating a new StorePlaceItemQuantity)
  @IsOptional()
  @IsString()
  itemName?: string;

  @IsOptional()
  @IsString()
  placeName?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  createdBy?: string; // or take from JWT in real auth
}
