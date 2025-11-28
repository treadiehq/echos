import { Controller, Get, Post, Delete, Param, Body, Query, Req, Res, UseGuards, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import archiver from 'archiver';
import { TracesService } from './traces.service';
import { StreamTokenService } from './stream-token.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CreateTraceDto, ReplayTraceDto } from './traces.dto';

@Controller('traces')
@UseGuards(AuthGuard)
export class TracesController {
  constructor(
    @Inject(TracesService) private readonly tracesService: TracesService,
    @Inject(StreamTokenService) private readonly streamTokenService: StreamTokenService
  ) {}

  @Get()
  async list(@Req() req: Request, @Query('limit') limit?: string) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    const traces = await this.tracesService.listTraces(orgId, limit ? parseInt(limit) : 50);
    return { traces };
  }

  // SECURITY: Rate limit trace creation
  @Throttle({ default: { ttl: 60000, limit: 30 } }) // 30 per minute
  @Post()
  async create(
    @Body() body: CreateTraceDto,
    @Req() req: Request
  ) {
    const orgId = req.orgId || body.orgId;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    if (!body.data) {
      throw new HttpException('data is required', HttpStatus.BAD_REQUEST);
    }

    const trace = await this.tracesService.createTrace(
      orgId, 
      body.data, 
      body.workflowId,
      body.workflowName
    );
    return { trace };
  }

  // Specific routes with :id prefix - MUST be before generic @Get(':id') to avoid route collision
  
  // Generate a secure token for SSE streaming (authenticated endpoint)
  @Post(':id/stream-token')
  async generateStreamToken(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.orgId;
    const userId = req.user?.id;
    
    if (!orgId || !userId) {
      throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
    }

    // Verify trace exists and belongs to org
    const trace = await this.tracesService.getTrace(id, orgId);
    if (!trace) {
      throw new HttpException('Trace not found', HttpStatus.NOT_FOUND);
    }

    const token = this.streamTokenService.generateToken(id, orgId, userId);
    return { token, expiresIn: 300 }; // 5 minutes
  }

  // Replay trace with modified configuration
  // SECURITY: Very strict rate limit - replay is expensive (LLM calls)
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 per minute
  @Post(':id/replay')
  async replay(
    @Param('id') id: string,
    @Body() body: ReplayTraceDto,
    @Req() req: Request
  ) {
    console.log('Replay endpoint hit:', { id, hasBody: !!body, hasWorkflowConfig: !!body?.workflowConfig });
    
    const orgId = req.orgId || req.body.orgId;
    
    if (!orgId) {
      console.log('No orgId found');
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    if (!body.workflowConfig) {
      console.log('No workflowConfig in body');
      throw new HttpException('workflowConfig is required', HttpStatus.BAD_REQUEST);
    }

    try {
      console.log('Calling replayTrace service...');
      const result = await this.tracesService.replayTrace(id, orgId, body.workflowConfig);
      console.log('Replay successful');
      return { result };
    } catch (error: any) {
      console.error('Replay failed:', error.message);
      throw new HttpException(
        `Replay failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // SECURITY: Rate limit SSE connections to prevent resource exhaustion
  @Throttle({ default: { ttl: 60000, limit: 20 } }) // 20 per minute
  @Public() // Public but validated by token
  @Get(':id/stream')
  async stream(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // Set CORS headers immediately
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Validate token from query parameter
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(401).send('Stream token required');
    }

    const tokenData = this.streamTokenService.validateToken(token);
    
    if (!tokenData) {
      return res.status(401).send('Invalid or expired token');
    }

    // Verify trace ID matches token
    if (tokenData.traceId !== id) {
      return res.status(403).send('Token not valid for this trace');
    }

    const trace = await this.tracesService.getTrace(id, tokenData.orgId);
    
    if (!trace) {
      return res.status(404).send('Trace not found');
    }

    // Set status code explicitly
    res.status(200);
    
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx/proxies

    // Write headers with explicit status
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'X-Accel-Buffering': 'no'
    });

    // Send initial data
    res.write(`event: open\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    // Poll for updates every 2 seconds
    const intervalId = setInterval(async () => {
      try {
        const updatedTrace = await this.tracesService.getTrace(id, tokenData.orgId);
        if (updatedTrace) {
          res.write(`event: update\ndata: ${JSON.stringify(updatedTrace.data)}\n\n`);
          
          // If trace is completed, close the connection
          if (updatedTrace.data?.status && ['ok', 'error', 'stopped'].includes(updatedTrace.data.status)) {
            clearInterval(intervalId);
            res.end();
          }
        }
      } catch (err) {
        console.error('Error polling trace:', err);
        clearInterval(intervalId);
        res.end();
      }
    }, 2000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(intervalId);
    });
  }

  // Generic :id routes - MUST come after specific routes like :id/replay, :id/stream, etc.
  
  @Get(':id')
  async read(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    const trace = await this.tracesService.getTrace(id, orgId);
    
    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    return res.json(trace);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    await this.tracesService.deleteTrace(id, orgId);
    return { success: true };
  }

  @Get('workflow/:workflowId')
  async listByWorkflow(
    @Param('workflowId') workflowId: string,
    @Req() req: Request,
    @Query('limit') limit?: string
  ) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    const traces = await this.tracesService.getTracesByWorkflow(
      workflowId,
      orgId,
      limit ? parseInt(limit) : 50
    );
    
    return { traces };
  }

  @Get(':id/export.zip')
  async exportZip(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      return res.status(400).send('orgId is required');
    }

    const trace = await this.tracesService.getTrace(id, orgId);
    
    if (!trace) {
      return res.status(404).send('Trace not found');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="trace-${id}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 }});
    archive.on('error', (err) => { res.status(500).send({ error: err.message }); });

    archive.pipe(res);

    // Include trace JSON
    archive.append(JSON.stringify(trace.data, null, 2), { name: `trace-${id}.json` });

    const readme = [
      '# Echos Trace Export',
      '',
      `- id: ${id}`,
      `- org_id: ${trace.org_id}`,
      `- workflow_id: ${trace.workflow_id || 'N/A'}`,
      `- created_at: ${trace.created_at}`,
      `- exportedAt: ${new Date().toISOString()}`,
      '',
      'This bundle contains the raw execution trace JSON.',
      'Fields:',
      '- steps[].attempt: retry number for that agent call',
      '- ceilings: maxDurationMs, maxCost set at runtime',
      '- totals: accumulated cost and duration',
      ''
    ].join('\n');

    archive.append(readme, { name: 'README.txt' });

    await archive.finalize();
  }
}
