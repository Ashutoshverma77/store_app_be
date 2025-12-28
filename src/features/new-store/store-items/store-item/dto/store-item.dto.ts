import { IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';

export class CreateItemDto {
  @IsString() itemNameId: string;
  @IsString() rackId: string;

  @IsOptional() @IsString() categoryId?: string;

  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() createdBy?: string;
}

export class UpdateItemDto {
  @IsString() id: string;

  @IsOptional() @IsString() itemNameId?: string;
  @IsOptional() @IsString() rackId?: string;
  @IsOptional() @IsString() categoryId?: string | null;

  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsString() imageUrl?: string;
}

export class ItemPagedQueryDto {
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;

  @IsOptional() @IsString() rackId?: string;
  @IsOptional() @IsString() categoryId?: string;
}


export class TransferRackDto {
  @IsMongoId()
  toRackId: string;
}


export class TransferItemDto {
  @IsMongoId()
  fromRackId: string;

  @IsMongoId()
  toRackId: string;

  @IsInt()
  @Min(1)
  qty: number;
}
