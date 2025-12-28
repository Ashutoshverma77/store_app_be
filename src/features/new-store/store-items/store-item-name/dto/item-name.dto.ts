import { IsOptional, IsString } from 'class-validator';

export class CreateItemNameDto {
  @IsString() name: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() createdBy?: string;
}

export class UpdateItemNameDto {
  @IsString() id: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() remark?: string;
}

export class ItemNamePagedQueryDto {
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string; // "-createdAt" | "name" | "-name"
}
