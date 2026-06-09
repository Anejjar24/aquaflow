import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SensorStatus, SensorType } from '../../database/entities/Sensor.entity';

export class CreateSensorDto {
  @ApiProperty({ example: 'Pressure-01', description: 'Sensor name', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: SensorType, description: 'Sensor measurement type' })
  @IsEnum(SensorType)
  type: SensorType;

  @ApiProperty({ example: 'bar', description: 'Measurement unit', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  unit: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'ID of the parent station' })
  @IsUUID()
  stationId: string;

  @ApiPropertyOptional({ example: 'Pump room A', description: 'Physical location within station' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 0.5, description: 'Minimum threshold — alert below this value' })
  @IsOptional()
  @IsNumber()
  minThreshold?: number;

  @ApiPropertyOptional({ example: 8.0, description: 'Maximum threshold — alert above this value' })
  @IsOptional()
  @IsNumber()
  maxThreshold?: number;

  @ApiPropertyOptional({ enum: SensorStatus, description: 'Operational status' })
  @IsOptional()
  @IsEnum(SensorStatus)
  status?: SensorStatus;

  @ApiPropertyOptional({ example: true, description: 'Enable automatic threshold alerts' })
  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean;

  @ApiPropertyOptional({ example: 'dev-abc123', description: 'MQTT device identifier' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: 'SN-20240101', description: 'Hardware serial number' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ type: Object, description: 'Arbitrary metadata JSON' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
