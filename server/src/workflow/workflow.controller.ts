import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { WorkflowService } from './workflow.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateWorkflowDto, UpdateWorkflowDto, RunWorkflowDto } from './workflow.dto';
import { Request } from 'express';

@Controller('workflows')
@UseGuards(AuthGuard)
export class WorkflowController {
  constructor(@Inject(WorkflowService) private readonly workflowService: WorkflowService) {}

  // SECURITY: Stricter rate limit for workflow creation (expensive operation)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 per minute
  @Post()
  async createWorkflow(
    @Body() body: CreateWorkflowDto,
    @Req() req: Request
  ) {
    if (!body.orgId || !body.name || !body.yamlConfig) {
      throw new HttpException('orgId, name, and yamlConfig are required', HttpStatus.BAD_REQUEST);
    }

    try {
      const workflow = await this.workflowService.createWorkflow(
        req.orgId || body.orgId,
        req.user.id,
        body.name,
        body.yamlConfig,
        body.description
      );

      return { workflow };
    } catch (error) {
      console.error('[WorkflowController] Error creating workflow:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to create workflow',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  async listWorkflows(@Req() req: Request) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    const workflows = await this.workflowService.listWorkflows(orgId);
    return { workflows };
  }

  @Get(':workflowId')
  async getWorkflow(@Param('workflowId') workflowId: string, @Req() req: Request) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    const workflow = await this.workflowService.getWorkflow(workflowId, orgId);
    
    if (!workflow) {
      throw new HttpException('Workflow not found', HttpStatus.NOT_FOUND);
    }

    return { workflow };
  }

  @Throttle({ default: { ttl: 60000, limit: 20 } }) // 20 per minute
  @Put(':workflowId')
  async updateWorkflow(
    @Param('workflowId') workflowId: string,
    @Body() body: UpdateWorkflowDto,
    @Req() req: Request
  ) {
    const orgId = req.orgId || body.orgId;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    const workflow = await this.workflowService.updateWorkflow(workflowId, orgId, {
      name: body.name,
      description: body.description,
      yaml_config: body.yamlConfig,
    });

    return { workflow };
  }

  @Delete(':workflowId')
  async deleteWorkflow(
    @Param('workflowId') workflowId: string,
    @Req() req: Request
  ) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    await this.workflowService.deleteWorkflow(workflowId, orgId);
    return { success: true };
  }

  @Get(':workflowId/diagram')
  async getDiagram(@Param('workflowId') workflowId: string, @Req() req: Request) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.workflowService.getDiagram(workflowId, orgId);
      return result;
    } catch (e) {
      console.error('[WorkflowController] getDiagram error:', e);
      return {
        error: e instanceof Error ? e.message : String(e),
        diagram: null,
        mermaid: null,
      };
    }
  }

  @Get(':workflowId/docs')
  async getDocs(@Param('workflowId') workflowId: string, @Req() req: Request) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.workflowService.getDocs(workflowId, orgId);
    } catch (e) {
      console.error('[WorkflowController] getDocs error:', e);
      return {
        error: e instanceof Error ? e.message : String(e),
        docs: null,
      };
    }
  }

  @Get(':workflowId/config')
  async getConfig(@Param('workflowId') workflowId: string, @Req() req: Request) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.workflowService.getConfig(workflowId, orgId);
      return result;
    } catch (e) {
      console.error('[WorkflowController] getConfig error:', e);
      return {
        error: e instanceof Error ? e.message : String(e),
        workflow: null,
        agents: [],
      };
    }
  }

  /**
   * Run a workflow with a given task
   * Returns trace info for real-time viewing
   */
  // SECURITY: Very strict rate limit for workflow runs (expensive LLM calls)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 per minute max
  @Post(':workflowId/run')
  async runWorkflow(
    @Param('workflowId') workflowId: string,
    @Body() body: RunWorkflowDto,
    @Req() req: Request
  ) {
    const orgId = req.orgId;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    if (!body.task) {
      throw new HttpException('task is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.workflowService.runWorkflow(
        workflowId,
        orgId,
        body.task,
        body.memory
      );

      return {
        success: true,
        taskId: result.taskId,
        orgId: result.orgId,
        traceUrl: `/traces/${result.taskId}`
      };
    } catch (error) {
      console.error('[WorkflowController] Error running workflow:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to run workflow',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

