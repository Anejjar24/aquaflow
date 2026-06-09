import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to denylist on logout' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
