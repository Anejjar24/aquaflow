import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'operator@aquaflow.io', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'secret123', description: 'Password (min 6 chars)', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Alice', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstname: string;

  @ApiProperty({ example: 'Dupont', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastname: string;
}
