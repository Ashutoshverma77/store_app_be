import { IsOptional, IsString } from 'class-validator';

export class CreateUnitNameDto {
  @IsString() name: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() createdBy?: string;
}

export class UpdateUnitNameDto {
  @IsString() id: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() remark?: string;
}

export class UnitNamePagedQueryDto {
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string; // "-createdAt" | "name" | "-name"
}
