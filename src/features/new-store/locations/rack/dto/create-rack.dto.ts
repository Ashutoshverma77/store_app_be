import { IsOptional, IsString } from 'class-validator';

export class CreateRackDto {
  @IsString()
  roomId: string;

  @IsOptional()
  @IsString()
  name?: string; // optional -> default to code

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  isScrap?: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
