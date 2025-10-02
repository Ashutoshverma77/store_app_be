import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateStorePlaceDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  createdBy: string;
}
