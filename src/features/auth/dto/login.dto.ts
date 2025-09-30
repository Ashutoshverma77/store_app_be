import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  identifier: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
