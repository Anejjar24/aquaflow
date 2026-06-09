import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { DatabaseService } from './database/database.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness + readiness check — no auth required' })
  @ApiResponse({ status: 200, description: 'All systems operational' })
  @ApiResponse({ status: 503, description: 'One or more subsystems degraded' })
  async health(@Res({ passthrough: true }) res: Response) {
    const [dbOk, redisOk, timescaleVersion, hypertableInfo] = await Promise.all([
      this.databaseService.healthCheck(),
      this.checkRedis(),
      this.databaseService.getTimescaleVersion(),
      this.databaseService.getHypertableInfo(),
    ]);

    const allOk = dbOk && redisOk;

    if (!allOk) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      db: {
        status: dbOk ? 'ok' : 'error',
        timescaledb: timescaleVersion ?? 'not installed',
        hypertable: hypertableInfo
          ? {
              chunks: hypertableInfo.num_chunks,
              compressionEnabled: hypertableInfo.compression_enabled,
              compressionRatioPct: hypertableInfo.compression_ratio_pct,
            }
          : 'not configured',
      },
      redis: { status: redisOk ? 'ok' : 'error' },
    };
  }

  private async checkRedis(): Promise<boolean> {
    try {
      await this.cacheManager.set('__health_check', '1', 3000);
      return true;
    } catch {
      return false;
    }
  }
}
