import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../database/entities/User.entity';

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: UserRole, description: 'New role for the user' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Activate or deactivate the user account' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
