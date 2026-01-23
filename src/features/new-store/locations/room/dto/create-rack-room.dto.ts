import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRackRoomDto {
  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsInt()
  @Min(1)
  @Max(100) // prevent from creating too many racks at once
  rackmake: number;

  @IsBoolean()
  isScrap: boolean;

  @IsBoolean()
  isOneRack: boolean;
}
