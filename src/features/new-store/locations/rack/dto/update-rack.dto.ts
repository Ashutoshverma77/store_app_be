import { IsOptional, IsString } from 'class-validator';

export class UpdateRackDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
