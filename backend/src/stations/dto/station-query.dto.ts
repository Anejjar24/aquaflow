import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { StationStatus, StationType } from '../../database/entities/Station.entity';

export class StationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, description: 'Results per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: StationStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(StationStatus)
  status?: StationStatus;

  @ApiPropertyOptional({ enum: StationType, description: 'Filter by type' })
  @IsOptional()
  @IsEnum(StationType)
  type?: StationType;

  @ApiPropertyOptional({ example: 'nord', description: 'Search by name (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;
}
