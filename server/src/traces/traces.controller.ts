import { Controller, Get, Post, Delete, Param, Body, Query, Req, Res, UseGuards, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import archiver from 'archiver';
import { TracesService } from './traces.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('traces')
@UseGuards(AuthGuard)
export class TracesController {
  constructor(@Inject(TracesService) private readonly tracesService: TracesService) {}

  @Get()
  async list(@Req() req: Request, @Query('limit') limit?: string) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      throw new HttpException('orgId is required', HttpStatus.BAD_REQUEST);
    }

    const traces = await this.tracesService.listTraces(orgId, limit ? parseInt(limit) : 50);
    return { traces };
  }

  @Post()
  async create(
    @Body() body: { orgId?: string; workflowId?: string; workflowName?: string; data: any },
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

  @Get(':id/stream')
  async stream(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const orgId = req.orgId || req.query.orgId as string;
    
    if (!orgId) {
      return res.status(400).send('orgId is required');
    }

    const trace = await this.tracesService.getTrace(id, orgId);
    
    if (!trace) {
      return res.status(404).send('Trace not found');
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Send initial data
    res.write(`event: open\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    // Poll for updates every 2 seconds
    const intervalId = setInterval(async () => {
      try {
        const updatedTrace = await this.tracesService.getTrace(id, orgId);
        if (updatedTrace) {
          res.write(`event: update\ndata: ${JSON.stringify(updatedTrace.data)}\n\n`);
          
          // If trace is completed, close the connection
          if (updatedTrace.data?.status && ['ok', 'error', 'stopped'].includes(updatedTrace.data.status)) {
            clearInterval(intervalId);
            res.end();
          }
        }
      } catch (err) {
        console.error('Error streaming trace:', err);
        clearInterval(intervalId);
        res.end();
      }
    }, 2000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(intervalId);
      res.end();
    });
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
