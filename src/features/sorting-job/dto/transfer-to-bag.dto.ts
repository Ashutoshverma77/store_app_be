// src/sorting-jobs/dto/transfer-to-bag.dto.ts
import { IsBoolean, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TransferToBagDto {
  // which input bag row are you transferring from?
  @IsMongoId()
  sourceBagId: string;

  // where are you transferring to?
  @IsMongoId()
  targetBagId: string;

  @IsNumber()
  @Min(0.000001)
  transferQtyInWt: number;
}
