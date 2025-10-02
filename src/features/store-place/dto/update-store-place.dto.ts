
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateStorePlaceDto {
  id: string;

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
}
