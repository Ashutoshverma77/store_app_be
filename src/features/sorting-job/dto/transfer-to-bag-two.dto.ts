// src/sorting-jobs/dto/transfer-to-bag.dto.ts
import { IsMongoId, IsNumber, IsOptional, Min } from 'class-validator';

export class TransferToBagTwoDto {
  @IsMongoId()
  targetBagId: string;

  @IsNumber()
  @Min(0.000001)
  transferQtyInWt: number;

  @IsOptional()
  createdBy?: string;
}
