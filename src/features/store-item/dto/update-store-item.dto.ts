import { PartialType } from '@nestjs/mapped-types';
import { CreateStoreItemDto } from './create-store-item.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateStoreItemDto {
  id: string;

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
}
