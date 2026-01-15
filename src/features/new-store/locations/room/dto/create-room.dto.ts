import { IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  // @IsOptional()
  // @IsString()
  // name?: string; // optional -> if not provided, backend can derive from code

  @IsOptional()
  isOneRack?: boolean;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  isScrap?: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
