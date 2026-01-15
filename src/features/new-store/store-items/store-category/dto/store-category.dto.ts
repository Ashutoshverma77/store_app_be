import { IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString() name: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() parentId?: string; // optional => subcategory
  @IsOptional() @IsString() isbag?: boolean; // optional => subcategory
  @IsOptional() @IsString() isMachine?: boolean; // optional => subcategory
  @IsOptional() @IsString() createdBy?: string;
}

export class UpdateCategoryDto {
  @IsString() id: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() parentId?: string | null;
}

export class CategoryPagedQueryDto {
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
}
