import { Body, Controller, Get, Header, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { User, UserRole } from '../database/entities/User.entity';
import { AlertQueryDto } from './dto/alert-query.dto';
import { CreateAlertDto } from './dto/create-alert.dto';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth('access-token')
@Controller('alerts')
@UseGuards(JwtGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('export/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="alerts.csv"')
  @ApiOperation({ summary: 'Export filtered alerts as a CSV file (max 10 000 rows)' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  exportCsv(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('type') type?: string,
    @Query('stationId') stationId?: string,
    @Query('sensorId') sensorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<string> {
    return this.alertsService.exportCsv({ status, severity, type, stationId, sensorId, from, to });
  }

  @Get()
  @ApiOperation({ summary: 'List alerts (paginated, filterable by status/severity/type/station/sensor)' })
  @ApiResponse({ status: 200, description: 'Paginated alert list' })
  findAll(@Query() query: AlertQueryDto) {
    return this.alertsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single alert' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert object' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  findOne(@Param('id') id: string) {
    return this.alertsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Manually create an alert (admin/operator)' })
  @ApiResponse({ status: 201, description: 'Alert created and broadcast via WebSocket' })
  create(@Body() dto: CreateAlertDto) {
    return this.alertsService.create(dto);
  }

  @Patch(':id/acknowledge')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged' })
  acknowledge(@Param('id') id: string, @Request() req: { user: User }) {
    return this.alertsService.acknowledge(id, req.user);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert resolved' })
  resolve(@Param('id') id: string, @Request() req: { user: User }) {
    return this.alertsService.resolve(id, req.user);
  }
}
