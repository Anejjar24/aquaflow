import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { SensorStatus, SensorType } from '../../database/entities/Sensor.entity';

export class SensorQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by parent station UUID' })
  @IsOptional()
  @IsUUID()
  stationId?: string;

  @ApiPropertyOptional({ enum: SensorType })
  @IsOptional()
  @IsEnum(SensorType)
  type?: SensorType;

  @ApiPropertyOptional({ enum: SensorStatus })
  @IsOptional()
  @IsEnum(SensorStatus)
  status?: SensorStatus;

  @ApiPropertyOptional({ example: 'pressure', description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;
}
