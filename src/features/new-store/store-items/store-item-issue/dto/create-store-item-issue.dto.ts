import { Type } from 'class-transformer';
import { IsInt, IsMongoId, Min, ValidateNested } from 'class-validator';

export class IssueOneLineDto {
  //   @IsMongoId()
  issuedBy: string;

  //   @IsMongoId()
  itemId: string; // StoreNewItem._id (same as IssueLine.itemId)

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty: number;
}

export class IssueBulkLineDto {
  //   @IsMongoId()
  itemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty: number;
}

export class IssueBulkDto {
  //   @IsMongoId()
  issuedBy: string;

  @ValidateNested({ each: true })
  @Type(() => IssueBulkLineDto)
  lines: IssueBulkLineDto[];
}

export class ReturnLineDto {
  @IsMongoId()
  returnedBy: string;

  @IsMongoId()
  itemId: string;

  // good qty returned to stock
  @IsInt()
  @Min(0)
  goodQty: number;

  // scrap qty (removed from stock)
  @IsInt()
  @Min(0)
  scrapQty: number;
}

export class ReturnBulkDto {
  @IsMongoId()
  returnedBy: string;

  lines: { itemId: string; goodQty: number; scrapQty: number }[];
}
