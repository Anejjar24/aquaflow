import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from '../common/guards/jwt.guard';
import { KafkaConsumerService } from '../iot/kafka/kafka.consumer.service';
import { AnalyticsService } from './analytics.service';
import { SensorStatsQueryDto, StationHistoryQueryDto } from './dto/analytics-query.dto';

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
@UseGuards(JwtGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) {}

  // ── Overview ────────────────────────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({ summary: 'System-wide counts: stations, sensors, alerts, maintenance' })
  @ApiResponse({ status: 200 })
  getOverview() {
    return this.analyticsService.getOverview();
  }

  // ── Station Status grid (Tab 1) ─────────────────────────────────────────────

  @Get('station-status')
  @ApiOperation({ summary: 'Per-station health: sensor counts by status, open alerts, last reading' })
  @ApiResponse({ status: 200 })
  getStationStatus() {
    return this.analyticsService.getStationStatus();
  }

  // ── Anomaly timeline — alert feed + scatter data (Tab 2) ───────────────────

  @Get('anomaly-timeline')
  @ApiOperation({ summary: 'Recent anomaly and threshold-violation alerts with station/sensor context' })
  @ApiQuery({ name: 'hours',  required: false, description: 'Look-back window in hours (default: 24)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max events returned (default: 100)' })
  @ApiResponse({ status: 200 })
  async getAnomalyTimeline(
    @Query('hours',  new ParseIntPipe({ optional: true })) hours?:  number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.analyticsService.getAnomalyTimeline(hours ?? 24, limit ?? 100);
  }

  // ── Network trend — 6h bucketed series (Tab 1 chart) ──────────────────────

  @Get('network-trend')
  @ApiOperation({ summary: 'Hourly-bucketed average reading across all sensors for the last N hours' })
  @ApiQuery({ name: 'hours', required: false, description: 'Look-back window (default: 6)' })
  @ApiResponse({ status: 200 })
  async getNetworkTrend(
    @Query('hours', new ParseIntPipe({ optional: true })) hours?: number,
  ) {
    return this.analyticsService.getNetworkTrend(hours ?? 6);
  }

  // ── Data freshness — repurposed pipeline/stats (no Kafka language exposed) ─

  @Get('data-freshness')
  @ApiOperation({ summary: 'Monitoring pipeline status: last reading timestamp, consumer health' })
  @ApiResponse({ status: 200 })
  getDataFreshness() {
    const stats = this.kafkaConsumer.getPipelineStats();
    return {
      lastReadingAt:     stats.lastReadingAt   ?? null,
      lastAnomalyAt:     stats.lastAnomalyAt   ?? null,
      totalMeasurements: stats.readingsConsumed ?? 0,
      totalAnomalies:    stats.anomaliesConsumed ?? 0,
      monitoringActive:  this.kafkaConsumer.getIsRunning(),
    };
  }

  // ── Keep old pipeline/stats for backward compat (internal/admin) ───────────

  @Get('pipeline/stats')
  @ApiOperation({ summary: '[Internal] Raw Kafka consumer stats' })
  @ApiResponse({ status: 200 })
  getPipelineStats() {
    return {
      ...this.kafkaConsumer.getPipelineStats(),
      consumerRunning: this.kafkaConsumer.getIsRunning(),
    };
  }

  // ── Spark pre-computed KPIs (Tab 2 z-score table) ─────────────────────────

  @Get('kpis')
  @ApiOperation({ summary: 'Pre-computed sensor KPIs from the aggregation engine (sensor_aggregates)' })
  @ApiQuery({ name: 'granularity', required: false, enum: ['hourly', 'daily'] })
  @ApiQuery({ name: 'hours',       required: false })
  @ApiResponse({ status: 200 })
  async getKpis(
    @Query('granularity') granularity?: 'hourly' | 'daily',
    @Query('hours', new ParseIntPipe({ optional: true })) hours?: number,
  ) {
    return this.analyticsService.getKpis(granularity ?? 'hourly', hours ?? 24);
  }

  // ── System metrics / measurement volume (Tab 3) ────────────────────────────

  @Get('system-metrics')
  @ApiOperation({ summary: 'Measurement volume and top-sensor throughput for the look-back window' })
  @ApiQuery({ name: 'hours', required: false })
  @ApiResponse({ status: 200 })
  async getSystemMetrics(
    @Query('hours', new ParseIntPipe({ optional: true })) hours?: number,
  ) {
    return this.analyticsService.getSystemMetrics(hours ?? 24);
  }

  // ── Network trend (alias kept for backward compat) ─────────────────────────

  // ── Per-sensor stats — FIXED (Tab 4 Station Detail) ───────────────────────

  @Get('sensors/:id/stats')
  @ApiOperation({ summary: 'Aggregated statistics + time-series for one sensor' })
  @ApiParam({ name: 'id', description: 'Sensor UUID' })
  @ApiQuery({ name: 'from',        required: false })
  @ApiQuery({ name: 'to',          required: false })
  @ApiQuery({ name: 'granularity', required: false })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getSensorStats(
    @Param('id') id: string,
    @Query() query: SensorStatsQueryDto,
  ) {
    const result = await this.analyticsService.getSensorStats(id, query);
    if (!result) throw new NotFoundException(`Sensor ${id} not found`);
    return result;
  }

  // ── Station history ─────────────────────────────────────────────────────────

  @Get('stations/:id/history')
  @ApiOperation({ summary: 'Per-sensor bucketed readings for an entire station' })
  @ApiParam({ name: 'id', description: 'Station UUID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async getStationHistory(
    @Param('id') id: string,
    @Query() query: StationHistoryQueryDto,
  ) {
    const result = await this.analyticsService.getStationHistory(id, query);
    if (!result) throw new NotFoundException(`Station ${id} not found`);
    return result;
  }
}
