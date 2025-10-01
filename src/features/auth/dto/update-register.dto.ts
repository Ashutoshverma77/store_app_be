import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsEmail, IsNotEmpty, ValidateNested } from 'class-validator';
import { RegisterDto } from './register.dto';
import { Type } from 'class-transformer';

export class UpdateRegistorDto {
  @IsNotEmpty()
  id: string;
  @IsEmail()
  email: string;
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  phoneNumber: string;

  @IsNotEmpty()
  isActive: boolean;

  @IsNotEmpty()
  isSuperAdmin: boolean;

 @IsArray()
  @IsNotEmpty()
  apps: string[];
  
  @IsArray()
  @IsNotEmpty()
  appWorks: string[];
}
