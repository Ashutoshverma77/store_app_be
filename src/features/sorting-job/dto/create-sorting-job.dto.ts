// src/sorting-jobs/dto/create-sorting-job.dto.ts
import { IsArray, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSortingJobInputBagDto {
  @IsMongoId()
  @IsOptional()
  bagId?: string;

  @IsString()
  @IsNotEmpty()
  bagCode: string;

  @IsNumber()
  @Min(0)
  qtyInWt: number;
}

export class CreateSortingJobDto {
  @IsMongoId()
  itemId: string;

  @IsString()
  @IsNotEmpty()
  itemName: string;

  @IsString()
  @IsOptional()
  machineName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSortingJobInputBagDto)
  inputBags: CreateSortingJobInputBagDto[];
}
