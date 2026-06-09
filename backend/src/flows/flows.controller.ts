import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '../database/entities/User.entity';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CreateFlowDto } from './dto/create-flow.dto';
import { ExecuteFlowDto } from './dto/execute-flow.dto';
import { FlowExecutorService } from './flow-executor.service';
import { FlowsService } from './flows.service';
import { WorkflowSchedulerService } from './workflow-scheduler.service';

@ApiTags('flows')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('flows')
export class FlowsController {
  constructor(
    private readonly flowsService: FlowsService,
    private readonly executorService: FlowExecutorService,
    private readonly schedulerService: WorkflowSchedulerService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created' })
  create(@Body() dto: CreateFlowDto, @Request() req: { user: User }) {
    return this.flowsService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List all workflows' })
  @ApiResponse({ status: 200, description: 'Array of workflow records' })
  findAll() {
    return this.flowsService.findAll();
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'List execution history for a workflow (last 50 runs)' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Array of WorkflowExecution records, newest first' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  getExecutions(@Param('id') id: string) {
    return this.flowsService.getExecutions(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Workflow object' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  findOne(@Param('id') id: string) {
    return this.flowsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a workflow graph' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Updated workflow' })
  update(@Param('id') id: string, @Body() dto: CreateFlowDto, @Request() req: { user: User }) {
    return this.flowsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  remove(@Param('id') id: string) {
    return this.flowsService.remove(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a workflow — enables scheduled/MQTT triggers' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Workflow activated' })
  async activate(@Param('id') id: string) {
    const workflow = await this.flowsService.activate(id);
    await this.schedulerService.reloadWorkflow(id);
    return workflow;
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a workflow — disables all triggers' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Workflow deactivated' })
  async deactivate(@Param('id') id: string) {
    const workflow = await this.flowsService.deactivate(id);
    await this.schedulerService.reloadWorkflow(id);
    return workflow;
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute a workflow graph directly (ad-hoc run)' })
  @ApiResponse({ status: 201, description: 'Execution result with per-node outputs' })
  execute(@Body() dto: ExecuteFlowDto, @Request() req: { user: User }) {
    return this.executorService.execute(dto.graph, dto.input ?? {}, {
      workflowId: dto.graph.id,
      user: req.user,
      triggerSource: 'manual',
    });
  }
}
