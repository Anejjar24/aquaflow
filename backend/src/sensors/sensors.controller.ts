import {
  Body, Controller, Delete, Get, Header, HttpCode, HttpStatus,
  Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/User.entity';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { SensorQueryDto } from './dto/sensor-query.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { SensorsService } from './sensors.service';

@ApiTags('sensors')
@ApiBearerAuth('access-token')
@Controller('sensors')
@UseGuards(JwtGuard, RolesGuard)
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Get()
  @ApiOperation({ summary: 'List sensors (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Paginated sensor list (cached 60 s)' })
  findAll(@Query() query: SensorQueryDto) {
    return this.sensorsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single sensor with station + recent alerts' })
  @ApiParam({ name: 'id', description: 'Sensor UUID' })
  @ApiResponse({ status: 200, description: 'Sensor object' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  findOne(@Param('id') id: string) {
    return this.sensorsService.findOne(id);
  }

  @Get(':id/data/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sensor-data.csv"')
  @ApiOperation({ summary: 'Export sensor readings as a CSV file (max 5 000 rows)' })
  @ApiParam({ name: 'id', description: 'Sensor UUID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max rows to export (default 5000)' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date lower bound' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date upper bound' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  exportDataCsv(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<string> {
    return this.sensorsService.exportDataCsv(id, Number(limit) || 5_000, from, to);
  }

  @Get(':id/data')
  @ApiOperation({ summary: 'Get historical sensor readings' })
  @ApiParam({ name: 'id', description: 'Sensor UUID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max readings to return (default 100)' })
  @ApiResponse({ status: 200, description: 'Array of SensorData records (newest first)' })
  findData(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.sensorsService.findData(id, Number(limit) || 100);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new sensor (admin/operator)' })
  @ApiResponse({ status: 201, description: 'Sensor created' })
  create(@Body() dto: CreateSensorDto) {
    return this.sensorsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update a sensor (admin/operator)' })
  @ApiParam({ name: 'id', description: 'Sensor UUID' })
  @ApiResponse({ status: 200, description: 'Updated sensor' })
  update(@Param('id') id: string, @Body() dto: UpdateSensorDto) {
    return this.sensorsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a sensor (admin only)' })
  @ApiParam({ name: 'id', description: 'Sensor UUID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@Param('id') id: string) {
    await this.sensorsService.remove(id);
  }

  @Post(':id/reading')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Manually inject a sensor reading (admin/operator)',
    description:
      'Simulates an MQTT data point — updates lastReading/lastReadingAt on the sensor ' +
      'and persists a SensorData record. Use this to test automation flows in the Builder ' +
      'without a live MQTT device.',
  })
  @ApiParam({ name: 'id', description: 'Sensor UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['value'],
      properties: { value: { type: 'number', example: 25.5 } },
    },
  })
  @ApiResponse({ status: 201, description: 'Reading injected — returns updated sensor snapshot' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  injectReading(@Param('id') id: string, @Body('value') value: number) {
    return this.sensorsService.injectReading(id, value);
  }
}
