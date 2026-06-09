import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { User, UserRole } from '../database/entities/User.entity';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { MaintenanceQueryDto } from './dto/maintenance-query.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@ApiBearerAuth('access-token')
@Controller('maintenance')
@UseGuards(JwtGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'List work orders (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Paginated maintenance list' })
  findAll(@Query() query: MaintenanceQueryDto) {
    return this.maintenanceService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single work order' })
  @ApiParam({ name: 'id', description: 'Maintenance UUID' })
  @ApiResponse({ status: 200, description: 'Maintenance object' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  findOne(@Param('id') id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Create a work order (admin/operator/technician)' })
  @ApiResponse({ status: 201, description: 'Work order created' })
  create(@Body() dto: CreateMaintenanceDto, @Request() req: { user: User }) {
    return this.maintenanceService.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Update a work order' })
  @ApiParam({ name: 'id', description: 'Maintenance UUID' })
  @ApiResponse({ status: 200, description: 'Updated work order' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto) {
    return this.maintenanceService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a work order (admin only)' })
  @ApiParam({ name: 'id', description: 'Maintenance UUID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@Param('id') id: string) {
    await this.maintenanceService.remove(id);
  }
}
