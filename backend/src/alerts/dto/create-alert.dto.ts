import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { AlertSeverity, AlertType } from '../../database/entities/Alert.entity';

export class CreateAlertDto {
  @ApiProperty({ enum: AlertType, description: 'Alert type / trigger category' })
  @IsEnum(AlertType)
  type: AlertType;

  @ApiProperty({ enum: AlertSeverity, description: 'Alert severity level' })
  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @ApiProperty({ example: 'Pressure exceeded 8 bar on Sensor-01', description: 'Short alert message' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: 'Sustained over-pressure for 5 minutes', description: 'Detailed description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'UUID of the related station' })
  @IsOptional()
  @IsUUID()
  stationId?: string;

  @ApiPropertyOptional({ description: 'UUID of the related sensor' })
  @IsOptional()
  @IsUUID()
  sensorId?: string;

  @ApiPropertyOptional({ example: 'iot-service', description: 'Source system identifier' })
  @IsOptional()
  @IsString()
  sourceSystem?: string;

  @ApiPropertyOptional({ type: Object, description: 'Additional structured data (readings, thresholds, etc.)' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
