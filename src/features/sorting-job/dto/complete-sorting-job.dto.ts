// src/sorting-jobs/dto/transfer-sorting-job.dto.ts
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class TransferSortingJobDto {
  // transfer is ALWAYS for an existing input bag
  @IsMongoId()
  @IsOptional()
  bagId?: string;

  @IsString()
  @IsNotEmpty()
  bagCode: string;

  @IsNumber()
  @Min(0.000001)
  transferQtyInWt: number;

  @IsOptional()
  createdBy?: string;
}
