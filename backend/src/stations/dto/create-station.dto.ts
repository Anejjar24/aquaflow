import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { StationStatus, StationType } from '../../database/entities/Station.entity';

export class CreateStationDto {
  @ApiProperty({ example: 'Station Nord', description: 'Station name', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Zone industrielle, Alger', description: 'Physical location', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  location: string;

  @ApiProperty({ example: 36.7372, description: 'Latitude (decimal degrees)' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 3.0869, description: 'Longitude (decimal degrees)' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 5000, description: 'Storage/treatment capacity (numeric value)' })
  @IsNumber()
  capacity: number;

  @ApiPropertyOptional({ example: 'm3', description: 'Unit for capacity', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  capacityUnit?: string;

  @ApiPropertyOptional({ enum: StationType, description: 'Station type' })
  @IsOptional()
  @IsEnum(StationType)
  type?: StationType;

  @ApiPropertyOptional({ enum: StationStatus, description: 'Operational status' })
  @IsOptional()
  @IsEnum(StationStatus)
  status?: StationStatus;

  @ApiPropertyOptional({ example: 'Main treatment facility for the northern district' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['pump-01', 'filter-02'], description: 'Equipment IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipments?: string[];

  @ApiPropertyOptional({ type: Object, description: 'Arbitrary metadata JSON' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
