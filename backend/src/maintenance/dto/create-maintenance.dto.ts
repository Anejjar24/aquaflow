import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MaintenancePriority, MaintenanceStatus, MaintenanceType } from '../../database/entities/Maintenance.entity';

export class CreateMaintenanceDto {
  @ApiProperty({ example: 'Replace pump seal', description: 'Work order title', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ enum: MaintenanceType, description: 'Type of maintenance work' })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiPropertyOptional({ enum: MaintenanceStatus, description: 'Initial status (default: scheduled)' })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @ApiPropertyOptional({ enum: MaintenancePriority, description: 'Priority level (default: medium)' })
  @IsOptional()
  @IsEnum(MaintenancePriority)
  priority?: MaintenancePriority;

  @ApiProperty({ example: 'Seal on pump #3 is leaking, requires immediate replacement' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'UUID of the station this work order belongs to' })
  @IsUUID()
  stationId: string;

  @ApiPropertyOptional({ description: 'UUID of the technician to assign' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ example: 'Pump-03', description: 'Equipment identifier or name' })
  @IsOptional()
  @IsString()
  equipment?: string;

  @ApiPropertyOptional({ example: 'SEAL-40MM-VITON', description: 'Spare part number' })
  @IsOptional()
  @IsString()
  partNumber?: string;

  @ApiPropertyOptional({ example: 250.0, description: 'Estimated cost in local currency' })
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @ApiPropertyOptional({ example: 4.5, description: 'Estimated duration in hours' })
  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;

  @ApiPropertyOptional({ example: '2026-05-20T08:00:00Z', description: 'Scheduled date/time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ example: 'Requires station shutdown for 2 hours' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: Object, description: 'Arbitrary metadata JSON' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
