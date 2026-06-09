import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@aquaflow.io', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin123', description: 'Password (min 6 chars)', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
