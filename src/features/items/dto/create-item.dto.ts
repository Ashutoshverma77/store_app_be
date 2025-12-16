// src/items/dto/create-item.dto.ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateItemDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  sizeId?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingStock?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  createdBy?: string;
}
