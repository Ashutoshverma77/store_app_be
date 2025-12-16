// src/bags/dto/create-bag.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsIn,
  IsInt,
} from 'class-validator';

export class CreateBagDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsString()
  @IsNotEmpty()
  bagCode: string;

  @IsString()
  @IsNotEmpty()
  itemName: string;

  @IsNumber()
  @Min(0)
  itemStock: number;

  @IsNumber()
  @Min(0)
  itemUsed: number;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  approvedStatus?: 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @IsNumber()
  @Min(0)
  transferQty?: number;
  F;
  @IsOptional()
  @IsIn(['other_bag', 'sorting_machine', 'inStock'])
  transferType?: 'other_bag' | 'sorting_machine' | 'inStock';

  @IsOptional()
  @IsInt()
  @Min(0)
  maxQty?: number;

  @IsOptional()
  createdBy?: string;
}
