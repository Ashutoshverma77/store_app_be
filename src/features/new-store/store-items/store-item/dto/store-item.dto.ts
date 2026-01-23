import {
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateItemDto {
  @IsString() itemName: string; // Made non-optional, validation to be handled in service based on subCategoryIds
  @IsOptional() @IsString() rackId?: string;
  @IsOptional() @IsString() scrapRackId?: string;

  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsArray() subCategoryIds?: string[];

  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() createdBy?: string;
}

export class UpdateItemDto {
  @IsString() id: string;

  // @IsOptional() @IsString() itemNameId?: string;
  @IsOptional() @IsString() rackId?: string;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsArray() categoryIds?: string[];
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() createdBy?: string;
}

export class ItemPagedQueryDto {
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;

  @IsOptional() @IsString() rackId?: string;
  @IsOptional() @IsString() categoryId?: string;
}

export class ReceivePagedQueryDto {
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
}

export class TransferRackDto {
  @IsMongoId()
  toRackId: string;

  createdBy: string;
}

export class TransferItemDto {
  @IsMongoId()
  fromRackId: string;

  @IsMongoId()
  toRackId: string;

  @IsInt()
  @Min(1)
  qty: number;

  createdBy: string;
}
