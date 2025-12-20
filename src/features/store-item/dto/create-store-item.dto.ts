// src/store-items/dto/create-store-item.dto.ts
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStoreItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  createdBy: string;

  // ✅ NEW
  @IsOptional()
  @IsBoolean()
  isBag?: boolean;

  // ✅ NEW: required only if isBag=true
  @ValidateIf((o) => o.isBag === true)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxQuantity?: number;
}
