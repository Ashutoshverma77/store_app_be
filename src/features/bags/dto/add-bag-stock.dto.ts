import { IsInt, IsMongoId, IsOptional, Min } from 'class-validator';

export class AddBagStockDto {
  @IsInt()
  @Min(1)
  qty: number;

  @IsOptional()
  createdBy?: string;
}
