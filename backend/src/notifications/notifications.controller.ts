import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../common/guards/jwt.guard';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List recent in-app notifications (broadcast to all users)' })
  @ApiResponse({ status: 200, description: 'Paginated notification list' })
  findAll(@Query() query: NotificationQueryDto) {
    return this.notificationsService.findAll(query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count (for bell badge)' })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  getUnreadCount() {
    return this.notificationsService.getUnreadCount();
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: '{ updated: number }' })
  markAllRead() {
    return this.notificationsService.markAllRead();
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Updated notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}
