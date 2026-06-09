import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { CreateMaintenanceDto } from './create-maintenance.dto';

export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {
  @ApiPropertyOptional({ example: 'Replaced seal and tested pump at 6 bar', description: 'Summary of work done' })
  @IsOptional()
  @IsString()
  workDone?: string;

  @ApiPropertyOptional({ example: 280.0, description: 'Actual cost incurred' })
  @IsOptional()
  @IsNumber()
  actualCost?: number;

  @ApiPropertyOptional({ example: 5.5, description: 'Actual duration in hours' })
  @IsOptional()
  @IsNumber()
  actualDuration?: number;

  @ApiPropertyOptional({ example: '2026-05-20T09:00:00Z', description: 'When work started (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({ example: '2026-05-20T14:30:00Z', description: 'When work completed (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'UUID of the technician to reassign' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
