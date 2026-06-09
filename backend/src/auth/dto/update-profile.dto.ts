import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ali', description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstname?: string;

  @ApiPropertyOptional({ example: 'Ben Salah', description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastname?: string;

  @ApiPropertyOptional({
    example: 'NewPass123!',
    description: 'New password — min 8 chars, must contain upper, lower, digit',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password?: string;
}
