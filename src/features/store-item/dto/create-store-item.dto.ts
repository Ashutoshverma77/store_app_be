// src/store-items/dto/create-store-item.dto.ts
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStoreItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  description?: string;

  @IsString()
  category: string;

//   totalStockQuantity: number;

//   stockAvailableQuantity: number;

//   stockIssueQuantity: number;

//   stockissueCompleted: number;

//   stockscrapQuantity: number;

//   stockPlace?: string[];

  @IsString()
  unit: string;

  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  createdBy: string;
}
