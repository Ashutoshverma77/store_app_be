// src/sorting-jobs/dto/add-bag-to-job.dto.ts
import { IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddBagToJobDto {
  @IsString()
  bagId: string;

  @IsNumber()
  @Min(0.000001)
  qtyInWt: number;

  @IsOptional()
  createdBy?: string;
}
