import { Type } from 'class-transformer';
import {
  IsArray,
  isBoolean,
  IsEmail,
  IsNotEmpty,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  phoneNumber: string;
  @MinLength(6)
  password: string;

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
