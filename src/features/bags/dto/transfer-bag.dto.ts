import { IsMongoId, IsNumber, Min } from 'class-validator';

export class TransferBagDto {
  @IsMongoId()
  sourceBagId: string;

  @IsMongoId()
  targetBagId: string;

  @IsNumber()
  @Min(0.000001)
  qty: number; // using number to support wt also
}
