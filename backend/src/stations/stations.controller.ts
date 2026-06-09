import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User, UserRole } from '../database/entities/User.entity';
import { CreateStationDto } from './dto/create-station.dto';
import { StationQueryDto } from './dto/station-query.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { StationsService } from './stations.service';

@ApiTags('stations')
@ApiBearerAuth('access-token')
@Controller('stations')
@UseGuards(JwtGuard, RolesGuard)
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  @ApiOperation({ summary: 'List stations (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Paginated station list' })
  findAll(@Query() query: StationQueryDto) {
    return this.stationsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single station with its sensors' })
  @ApiParam({ name: 'id', description: 'Station UUID' })
  @ApiResponse({ status: 200, description: 'Station object' })
  @ApiResponse({ status: 404, description: 'Station not found' })
  findOne(@Param('id') id: string) {
    return this.stationsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new station (admin/operator)' })
  @ApiResponse({ status: 201, description: 'Station created' })
  create(@Body() dto: CreateStationDto, @Request() req: { user: User }) {
    return this.stationsService.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update a station (admin/operator)' })
  @ApiParam({ name: 'id', description: 'Station UUID' })
  @ApiResponse({ status: 200, description: 'Updated station' })
  update(@Param('id') id: string, @Body() dto: UpdateStationDto) {
    return this.stationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a station (admin only)' })
  @ApiParam({ name: 'id', description: 'Station UUID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@Param('id') id: string) {
    await this.stationsService.remove(id);
  }
}
