import { IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  @IsOptional()
  @IsString()
  name?: string; // optional -> if not provided, backend can derive from code

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
