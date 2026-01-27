import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Double } from 'mongoose';

export class ScrapPagedQueryDto {
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
}

export class CreateStoreScrapDto {
  @IsString() itemId: string; // IT-AA001

  @IsString() rackId: string; // IT-AA001

  @IsString() roomId: string; // IT-AA001

  @IsNumber() itemQuantity: number;

  @IsOptional() @IsString() remark: string;

  @IsOptional() @IsString() createdBy: string;
}

export class UpdateStoreScrapDto {
  @IsString() id: string; // IT-AA001

  @IsString() itemId: string; // IT-AA001

  @IsString() rackId: string; // IT-AA001

  @IsString() roomId: string; // IT-AA001

  @IsNumber() itemQuantity: number;

  @IsOptional() @IsString() remark: string;

  @IsOptional() @IsString() createdBy: string;
}
