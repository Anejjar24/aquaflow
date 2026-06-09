import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum HistoryGranularity {
  MIN5  = '5min',
  MIN15 = '15min',
  MIN30 = '30min',
  HOUR  = 'hour',
  DAY   = 'day',
}

/** Maps UI granularity enum → TimescaleDB time_bucket interval string */
export const GRANULARITY_INTERVAL: Record<HistoryGranularity, string> = {
  [HistoryGranularity.MIN5]:  '5 minutes',
  [HistoryGranularity.MIN15]: '15 minutes',
  [HistoryGranularity.MIN30]: '30 minutes',
  [HistoryGranularity.HOUR]:  '1 hour',
  [HistoryGranularity.DAY]:   '1 day',
};

export class SensorStatsQueryDto {
  @ApiPropertyOptional({
    example: '2026-05-06T00:00:00Z',
    description: 'Range start (ISO 8601). Default: 24 h ago',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-05-13T00:00:00Z',
    description: 'Range end (ISO 8601). Default: now',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: HistoryGranularity,
    default: HistoryGranularity.HOUR,
    description: 'Bucket size for the time-series (default: 1 hour)',
  })
  @IsOptional()
  @IsEnum(HistoryGranularity)
  granularity?: HistoryGranularity = HistoryGranularity.HOUR;
}

export class StationHistoryQueryDto {
  @ApiPropertyOptional({
    enum: HistoryGranularity,
    default: HistoryGranularity.HOUR,
    description: 'Bucket size for aggregation',
  })
  @IsOptional()
  @IsEnum(HistoryGranularity)
  granularity?: HistoryGranularity = HistoryGranularity.HOUR;

  @ApiPropertyOptional({
    example: '2026-05-06T00:00:00Z',
    description: 'Range start (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-05-13T00:00:00Z',
    description: 'Range end (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
